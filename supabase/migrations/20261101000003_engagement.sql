-- Favorites, blocks, conversations, messages, notifications, reports, reviews

-- ---------------------------------------------------------------------------
-- Notifications (written only by trusted functions/triggers)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_ref uuid default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, reference_id)
  values (p_user, p_type, p_title, left(p_body, 300), p_link, p_ref);
$$;

-- Users may only flip read_at on their own notifications.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_client_call() and (
       new.user_id is distinct from old.user_id or new.type is distinct from old.type
    or new.title is distinct from old.title or new.body is distinct from old.body
    or new.link is distinct from old.link or new.reference_id is distinct from old.reference_id
    or new.created_at is distinct from old.created_at) then
    raise exception 'Only read status can be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  buyer_last_read_at timestamptz not null default now(),
  seller_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
     where id = p_conversation and auth.uid() in (buyer_id, seller_id)
  );
$$;

-- Start (or reuse) a conversation about a listing. Seller is derived from the
-- listing, never from the client.
create or replace function public.start_conversation(p_listing uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings;
  v_id uuid;
  v_recent integer;
  v_limit integer := coalesce((public.setting('max_new_conversations_per_hour'))::int, 15);
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sign in with an active account to contact sellers' using errcode = '42501';
  end if;

  select * into v_listing from public.listings l
   where l.id = p_listing and l.status = 'published' and public.listing_is_public(l);
  if v_listing.id is null then
    raise exception 'This listing is not available' using errcode = 'P0002';
  end if;
  if v_listing.seller_id = auth.uid() then
    raise exception 'You cannot message yourself' using errcode = '22023';
  end if;
  if public.is_blocked_between(auth.uid(), v_listing.seller_id) then
    raise exception 'You cannot contact this seller' using errcode = '42501';
  end if;

  select id into v_id from public.conversations
   where listing_id = p_listing and buyer_id = auth.uid();
  if v_id is not null then
    return v_id;
  end if;

  select count(*) into v_recent from public.conversations
   where buyer_id = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent >= v_limit then
    raise exception 'Too many new conversations. Please wait a while.' using errcode = 'P0001';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing, auth.uid(), v_listing.seller_id)
  returning id into v_id;

  perform public.record_listing_event(p_listing, 'contact');
  return v_id;
end;
$$;

-- Message write rules: participant, active, not blocked, rate limited.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_recent integer;
  v_limit integer := coalesce((public.setting('max_messages_per_minute'))::int, 20);
begin
  select * into v_conv from public.conversations where id = new.conversation_id;

  if public.is_client_call() then
    if new.sender_id is not null and new.sender_id <> auth.uid() then
      raise exception 'Cannot send messages as another user' using errcode = '42501';
    end if;
    new.sender_id := auth.uid();
    new.kind := 'text';
    new.created_at := now();
    new.body := trim(new.body);
    if v_conv.id is null or auth.uid() not in (v_conv.buyer_id, v_conv.seller_id) then
      raise exception 'Not a participant in this conversation' using errcode = '42501';
    end if;
    if not public.is_active_user() then
      raise exception 'Your account cannot send messages' using errcode = '42501';
    end if;
    if public.is_blocked_between(v_conv.buyer_id, v_conv.seller_id) then
      raise exception 'Messaging is blocked between these users' using errcode = '42501';
    end if;
    select count(*) into v_recent from public.messages
     where sender_id = auth.uid() and created_at > now() - interval '1 minute';
    if v_recent >= v_limit then
      raise exception 'You are sending messages too quickly' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_recipient uuid;
  v_title text;
  v_sender_name text;
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 120),
         buyer_last_read_at = case when new.sender_id = buyer_id then new.created_at else buyer_last_read_at end,
         seller_last_read_at = case when new.sender_id = seller_id then new.created_at else seller_last_read_at end
   where id = new.conversation_id
  returning * into v_conv;

  if new.kind = 'text' and new.sender_id is not null then
    v_recipient := case when new.sender_id = v_conv.buyer_id then v_conv.seller_id else v_conv.buyer_id end;
    -- One unread notification per conversation is enough
    if not exists (
      select 1 from public.notifications
       where user_id = v_recipient and type = 'message'
         and reference_id = v_conv.id and read_at is null
    ) then
      select title into v_title from public.listings where id = v_conv.listing_id;
      select display_name into v_sender_name from public.profiles where id = new.sender_id;
      perform public.notify(v_recipient, 'message',
        'New message from ' || coalesce(v_sender_name, 'a user'),
        'About "' || coalesce(v_title, 'a listing') || '": ' || new.body,
        '/messages/' || v_conv.id, v_conv.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Mark a conversation read for the current participant
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set buyer_last_read_at = case when buyer_id = auth.uid() then now() else buyer_last_read_at end,
         seller_last_read_at = case when seller_id = auth.uid() then now() else seller_last_read_at end
   where id = p_conversation and auth.uid() in (buyer_id, seller_id);

  update public.notifications set read_at = now()
   where user_id = auth.uid() and type = 'message'
     and reference_id = p_conversation and read_at is null;
end;
$$;

create or replace function public.unread_conversation_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.conversations c
   where (c.buyer_id = auth.uid() and c.last_message_at > c.buyer_last_read_at)
      or (c.seller_id = auth.uid() and c.last_message_at > coalesce(c.seller_last_read_at, '-infinity'));
$$;

-- Notice in related conversations when a listing is sold / reviewed by mods
create or replace function public.listings_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text;
begin
  if new.status = 'sold' and old.status <> 'sold' then
    v_prev := public.trust();
    insert into public.messages (conversation_id, sender_id, kind, body)
    select c.id, null, 'system', 'The seller marked this item as sold.'
      from public.conversations c where c.listing_id = new.id;
    perform public.untrust(v_prev);
  end if;
  return new;
end;
$$;

create trigger listings_after_status_change after update of status on public.listings
  for each row when (old.status is distinct from new.status)
  execute function public.listings_after_status_change();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create type public.report_reason as enum
  ('scam', 'fake_or_misleading', 'prohibited_item', 'spam', 'harassment', 'impersonation', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'user', 'message')),
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (target_type = 'listing' and listing_id is not null) or
    (target_type = 'user' and reported_user_id is not null) or
    (target_type = 'message' and message_id is not null)
  )
);

create index reports_status_idx on public.reports (status, created_at desc);
create unique index reports_one_open_per_target on public.reports
  (reporter_id, target_type, coalesce(listing_id, reported_user_id, message_id))
  where status in ('open', 'reviewing');

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  if public.is_client_call() then
    new.reporter_id := auth.uid();
    new.status := 'open';
    new.resolution_note := null;
    new.resolved_by := null;
    new.resolved_at := null;

    select count(*) into v_recent from public.reports
     where reporter_id = auth.uid() and created_at > now() - interval '1 hour';
    if v_recent >= 10 then
      raise exception 'Too many reports in a short time' using errcode = 'P0001';
    end if;

    if new.target_type = 'message' and not exists (
      select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
       where m.id = new.message_id and auth.uid() in (c.buyer_id, c.seller_id)) then
      raise exception 'You can only report messages from your conversations' using errcode = '42501';
    end if;
  end if;

  -- Derive the reported user for listings/messages
  if new.target_type = 'listing' then
    select seller_id into new.reported_user_id from public.listings where id = new.listing_id;
  elsif new.target_type = 'message' then
    select sender_id into new.reported_user_id from public.messages where id = new.message_id;
  end if;

  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report yourself' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------------------------------------------------------------------------
-- Reviews: only the buyer a seller marked a listing sold to may review, once.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, reviewer_id)
);

create index reviews_seller_idx on public.reviews (seller_id, created_at desc);

create or replace function public.reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_client_call() then
    new.reviewer_id := auth.uid();
    new.is_hidden := false;
    select seller_id into new.seller_id from public.listings
     where id = new.listing_id and status = 'sold' and sold_to_buyer_id = auth.uid();
    if new.seller_id is null then
      raise exception 'Only the confirmed buyer of a sold item can leave a review'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_before_insert();

create or replace function public.seller_rating(p_seller uuid)
returns table (average numeric, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(rating)::numeric, 1), count(*)::int
    from public.reviews where seller_id = p_seller and not is_hidden;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;

create policy "notifications own read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications own delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy "favorites own read" on public.favorites for select to authenticated
  using (user_id = auth.uid());
create policy "favorites own insert" on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.listings l where l.id = listing_id));
create policy "favorites own delete" on public.favorites for delete to authenticated
  using (user_id = auth.uid());

create policy "blocks own read" on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy "blocks own insert" on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
create policy "blocks own delete" on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Conversations: created only via start_conversation(); participants read.
create policy "conversations participants read" on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));

-- Messages: participants read and send. Admins see messages only via reports.
create policy "messages participants read" on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy "messages participants insert" on public.messages for insert to authenticated
  with check (public.is_conversation_participant(conversation_id) and sender_id = auth.uid());

create policy "reports own read" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "reports insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());

create policy "reviews public read" on public.reviews for select
  using (not is_hidden or reviewer_id = auth.uid() or public.is_admin());
create policy "reviews buyer insert" on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid());

revoke execute on function public.notify(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
revoke execute on function public.unread_conversation_count() from public, anon;
grant execute on function public.unread_conversation_count() to authenticated;

-- Listings, images, attribute values, status rules, moderation and search

create type public.listing_status as enum
  ('draft', 'pending_review', 'published', 'paused', 'sold', 'rejected', 'expired', 'removed');
create type public.listing_condition as enum
  ('new', 'used', 'refurbished', 'not_applicable');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default '', -- set by trigger
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null check (char_length(title) between 5 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  price numeric(14, 2) check (price is null or price >= 0),
  currency char(3) not null default 'GHS',
  is_negotiable boolean not null default false,
  condition public.listing_condition not null default 'used',
  quantity integer not null default 1 check (quantity between 1 and 100000),
  region_id smallint references public.regions (id),
  city text check (char_length(city) <= 80),
  approx_lat numeric(7, 4) check (approx_lat between -90 and 90),
  approx_lng numeric(7, 4) check (approx_lng between -180 and 180),
  status public.listing_status not null default 'draft',
  moderation_note text,
  flagged_terms text[] not null default '{}',
  sold_to_buyer_id uuid references public.profiles (id) on delete set null,
  view_count integer not null default 0,
  contact_count integer not null default 0,
  submitted_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);

create index listings_public_idx on public.listings (status, published_at desc);
create index listings_category_idx on public.listings (category_id, status, published_at desc);
create index listings_seller_idx on public.listings (seller_id, status, updated_at desc);
create index listings_region_idx on public.listings (region_id, status);
create index listings_price_idx on public.listings (status, price);
create index listings_search_idx on public.listings using gin (search_vector);
create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Moderation helpers
-- ---------------------------------------------------------------------------
-- Returns prohibited terms found in the text (case-insensitive, whole words).
create or replace function public.find_prohibited_terms(p_text text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct term), '{}')
  from jsonb_array_elements_text(coalesce(public.setting('prohibited_terms'), '[]'::jsonb)) as term
  where lower(p_text) ~ ('\m' || regexp_replace(lower(term), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M');
$$;

-- Insert defaults: slug, seller from auth, posting limits, initial status.
create or replace function public.listings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_count integer;
  v_today_count integer;
  v_max_active integer := coalesce((public.setting('max_active_listings_per_user'))::int, 50);
  v_max_daily integer := coalesce((public.setting('max_new_listings_per_day'))::int, 10);
begin
  if public.is_client_call() then
    new.seller_id := auth.uid();
    if new.status not in ('draft', 'pending_review') then
      raise exception 'New listings must start as a draft or be submitted for review'
        using errcode = '42501';
    end if;
    new.view_count := 0;
    new.contact_count := 0;
    new.published_at := null;
    new.sold_at := null;
    new.sold_to_buyer_id := null;
    new.moderation_note := null;

    select count(*) into v_today_count
      from public.listings
     where seller_id = new.seller_id and created_at > now() - interval '24 hours';
    if v_today_count >= v_max_daily then
      raise exception 'Daily posting limit reached (% listings in 24 hours)', v_max_daily
        using errcode = 'P0001';
    end if;

    select count(*) into v_active_count
      from public.listings
     where seller_id = new.seller_id
       and status in ('draft', 'pending_review', 'published', 'paused');
    if v_active_count >= v_max_active then
      raise exception 'Active listing limit reached (%)', v_max_active using errcode = 'P0001';
    end if;
  end if;

  new.currency := upper(coalesce(new.currency, 'GHS'));
  new.slug := left(public.slugify(new.title), 70) || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
  return new;
end;
$$;

create trigger listings_before_insert before insert on public.listings
  for each row execute function public.listings_before_insert();

-- Allowed seller-driven status transitions. Admin transitions are handled by
-- admin RPCs (which run as the definer and skip this table of rules).
create or replace function public.seller_transition_allowed(
  p_from public.listing_status, p_to public.listing_status
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('draft', 'pending_review'),
    ('pending_review', 'draft'),
    ('rejected', 'draft'),
    ('rejected', 'pending_review'),
    ('published', 'paused'),
    ('paused', 'published'),
    ('published', 'sold'),
    ('paused', 'sold'),
    ('sold', 'pending_review'),
    ('expired', 'pending_review'),
    ('expired', 'draft')
  );
$$;

-- Runs for every insert/update: enforces transitions for client calls,
-- re-review on content edits, auto-approval and keyword flagging.
create or replace function public.listings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status public.listing_status := case when tg_op = 'UPDATE' then old.status else 'draft' end;
  v_content_changed boolean := false;
  v_review_required boolean := coalesce((public.setting('require_listing_review'))::boolean, true);
  v_expiry_days integer := coalesce((public.setting('listing_expiry_days'))::int, 60);
begin
  if tg_op = 'UPDATE' then
    v_content_changed := new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.category_id is distinct from old.category_id;
  end if;

  if public.is_client_call() then
    if tg_op = 'UPDATE' then
      -- protected columns
      if new.seller_id is distinct from old.seller_id
         or new.view_count is distinct from old.view_count
         or new.contact_count is distinct from old.contact_count
         or new.moderation_note is distinct from old.moderation_note
         or new.flagged_terms is distinct from old.flagged_terms
         or new.published_at is distinct from old.published_at
         or new.submitted_at is distinct from old.submitted_at
         or new.expires_at is distinct from old.expires_at
         or new.created_at is distinct from old.created_at
         or new.slug is distinct from old.slug then
        raise exception 'Not allowed to change protected listing fields' using errcode = '42501';
      end if;

      if old.status = 'removed' then
        raise exception 'This listing was removed by moderators and cannot be edited'
          using errcode = '42501';
      end if;

      if not public.seller_transition_allowed(old.status, new.status) then
        raise exception 'Cannot change listing from % to %', old.status, new.status
          using errcode = '42501';
      end if;

      -- paused -> published only if nothing substantive changed meanwhile
      if old.status = 'paused' and new.status = 'published' and v_content_changed then
        new.status := 'pending_review';
      end if;

      -- editing a live listing's content sends it back to review
      if old.status in ('published', 'paused') and new.status in ('published', 'paused')
         and v_content_changed then
        new.status := 'pending_review';
      end if;

      if new.status = 'sold' and old.status <> 'sold' then
        new.sold_at := now();
        if new.sold_to_buyer_id is not null and not exists (
          select 1 from public.conversations c
           where c.listing_id = new.id and c.buyer_id = new.sold_to_buyer_id
        ) then
          raise exception 'Buyer must have contacted you about this listing'
            using errcode = '22023';
        end if;
      elsif new.status <> 'sold' then
        new.sold_to_buyer_id := null;
        new.sold_at := null;
      end if;
    end if;
  end if;

  -- Submission: run checks, auto-approve when allowed
  if new.status = 'pending_review' and (tg_op = 'INSERT' or v_old_status <> 'pending_review' or v_content_changed) then
    new.submitted_at := now();
    new.flagged_terms := public.find_prohibited_terms(new.title || ' ' || new.description);
    if not v_review_required and cardinality(new.flagged_terms) = 0 then
      new.status := 'published';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or v_old_status not in ('published', 'paused')) then
    new.published_at := now();
    new.expires_at := now() + make_interval(days => v_expiry_days);
    new.moderation_note := null;
  end if;

  return new;
end;
$$;

create trigger listings_before_write before insert or update on public.listings
  for each row execute function public.listings_before_write();

-- Required fields before a listing leaves draft
create or replace function public.listings_validate_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text;
begin
  if new.status in ('pending_review', 'published')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if char_length(coalesce(new.description, '')) < 20 then
      raise exception 'Description must be at least 20 characters' using errcode = '23514';
    end if;
    if new.region_id is null then
      raise exception 'Location region is required' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.categories c where c.id = new.category_id and not c.is_active
    ) then
      raise exception 'This category is not accepting listings' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' then
      if not exists (select 1 from public.listing_images i where i.listing_id = new.id) then
        raise exception 'Add at least one photo before submitting' using errcode = '23514';
      end if;
      select string_agg(a.label, ', ') into v_missing
        from public.category_attributes a
       where a.category_id in (select public.category_ancestors(new.category_id))
         and a.is_required
         and not exists (
           select 1 from public.listing_attribute_values v
            where v.listing_id = new.id and v.attribute_id = a.id
              and coalesce(v.value_text, v.value_number::text, v.value_bool::text) is not null
         );
      if v_missing is not null then
        raise exception 'Missing required details: %', v_missing using errcode = '23514';
      end if;
    else
      -- New rows have no images yet; they must be saved as drafts first.
      raise exception 'Save the listing as a draft and add photos before submitting'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- Runs after listings_before_write (alphabetical order of trigger names).
create trigger listings_validate_submission before insert or update on public.listings
  for each row execute function public.listings_validate_submission();

-- Public visibility rule, reused in policies and queries
create or replace function public.listing_is_public(l public.listings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select l.status in ('published', 'sold')
     and (l.status = 'sold' or l.expires_at is null or l.expires_at > now());
$$;

-- ---------------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, sort_order);

create or replace function public.listing_images_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := coalesce((public.setting('max_images_per_listing'))::int, 10);
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.listing_images where listing_id = new.listing_id) >= v_max then
      raise exception 'A listing can have at most % photos', v_max using errcode = '23514';
    end if;
    -- path must live under the uploader's folder: <uid>/<listing_id>/<file>
    if public.is_client_call() and split_part(new.storage_path, '/', 1) <> auth.uid()::text then
      raise exception 'Invalid image path' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger listing_images_guard before insert on public.listing_images
  for each row execute function public.listing_images_guard();

-- ---------------------------------------------------------------------------
-- Attribute values
-- ---------------------------------------------------------------------------
create table public.listing_attribute_values (
  listing_id uuid not null references public.listings (id) on delete cascade,
  attribute_id uuid not null references public.category_attributes (id) on delete cascade,
  value_text text check (char_length(value_text) <= 200),
  value_number numeric,
  value_bool boolean,
  primary key (listing_id, attribute_id)
);

create index listing_attribute_values_filter_idx
  on public.listing_attribute_values (attribute_id, value_text);
create index listing_attribute_values_num_idx
  on public.listing_attribute_values (attribute_id, value_number);

create or replace function public.listing_attribute_values_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attr public.category_attributes;
  v_category uuid;
begin
  select category_id into v_category from public.listings where id = new.listing_id;
  select * into v_attr from public.category_attributes where id = new.attribute_id;

  if v_attr.category_id not in (select public.category_ancestors(v_category)) then
    raise exception 'Attribute % does not apply to this category', v_attr.label
      using errcode = '23514';
  end if;

  if v_attr.type = 'number' and new.value_number is null and new.value_text is not null then
    raise exception '% must be a number', v_attr.label using errcode = '23514';
  end if;
  if v_attr.type = 'select' and new.value_text is not null
     and not (v_attr.options ? new.value_text) then
    raise exception 'Invalid option for %', v_attr.label using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_attribute_values_guard before insert or update on public.listing_attribute_values
  for each row execute function public.listing_attribute_values_guard();

-- ---------------------------------------------------------------------------
-- Daily stats (views and contact reveals) for seller analytics
-- ---------------------------------------------------------------------------
create table public.listing_daily_stats (
  listing_id uuid not null references public.listings (id) on delete cascade,
  day date not null default (now() at time zone 'Africa/Accra')::date,
  views integer not null default 0,
  contacts integer not null default 0,
  primary key (listing_id, day)
);

create or replace function public.record_listing_event(p_listing uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
  v_prev text;
begin
  if p_kind not in ('view', 'contact') then
    raise exception 'Unknown event';
  end if;
  select seller_id into v_seller from public.listings l
   where l.id = p_listing and public.listing_is_public(l);
  if v_seller is null or v_seller = auth.uid() then
    return; -- ignore non-public listings and the seller's own views
  end if;
  v_prev := public.trust();

  insert into public.listing_daily_stats (listing_id, views, contacts)
  values (p_listing, (p_kind = 'view')::int, (p_kind = 'contact')::int)
  on conflict (listing_id, day) do update
    set views = public.listing_daily_stats.views + excluded.views,
        contacts = public.listing_daily_stats.contacts + excluded.contacts;

  update public.listings
     set view_count = view_count + (p_kind = 'view')::int,
         contact_count = contact_count + (p_kind = 'contact')::int
   where id = p_listing;
  perform public.untrust(v_prev);
end;
$$;

-- Expire published listings past their date (call from a scheduler).
create or replace function public.expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.listings set status = 'expired'
   where status in ('published', 'paused') and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Renew an expiring or expired listing (owner only, no content change).
create or replace function public.renew_listing(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((public.setting('listing_expiry_days'))::int, 60);
  v_prev text := public.trust();
begin
  update public.listings
     set status = case when status = 'expired' then 'published'::public.listing_status else status end,
         expires_at = now() + make_interval(days => v_days)
   where id = p_listing
     and seller_id = auth.uid()
     and status in ('published', 'paused', 'expired')
     and public.is_active_user();
  if not found then
    raise exception 'Listing cannot be renewed' using errcode = '42501';
  end if;
  perform public.untrust(v_prev);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_attribute_values enable row level security;
alter table public.listing_daily_stats enable row level security;

create policy "listings public read" on public.listings for select
  using (
    public.listing_is_public(listings)
    and exists (select 1 from public.profiles p where p.id = seller_id and p.status = 'active')
  );
create policy "listings owner read" on public.listings for select to authenticated
  using (seller_id = auth.uid());
create policy "listings admin read" on public.listings for select to authenticated
  using (public.is_admin());
create policy "listings seller insert" on public.listings for insert to authenticated
  with check (seller_id = auth.uid() and public.can_sell());
create policy "listings seller update" on public.listings for update to authenticated
  using (seller_id = auth.uid() and public.is_active_user())
  with check (seller_id = auth.uid());
create policy "listings seller delete draft" on public.listings for delete to authenticated
  using (seller_id = auth.uid() and status in ('draft', 'rejected'));

-- Child rows follow the parent's visibility (RLS on listings applies in the subquery)
create policy "images read with listing" on public.listing_images for select
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "images owner insert" on public.listing_images for insert to authenticated
  with check (exists (
    select 1 from public.listings l
     where l.id = listing_id and l.seller_id = auth.uid() and l.status <> 'removed'));
create policy "images owner update" on public.listing_images for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "images owner delete" on public.listing_images for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

create policy "attr values read with listing" on public.listing_attribute_values for select
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "attr values owner insert" on public.listing_attribute_values for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "attr values owner update" on public.listing_attribute_values for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "attr values owner delete" on public.listing_attribute_values for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

create policy "stats owner read" on public.listing_daily_stats for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

revoke execute on function public.expire_listings() from public, anon, authenticated;
revoke execute on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;
grant execute on function public.record_listing_event(uuid, text) to anon, authenticated;

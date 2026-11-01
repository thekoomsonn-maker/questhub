-- Promotions, payments (disabled by default), audit log, admin RPCs, search,
-- storage buckets and realtime.

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id);

create or replace function public.log_admin_action(
  p_action text, p_target_type text, p_target_id text, p_reason text, p_meta jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, nullif(trim(p_reason), ''), coalesce(p_meta, '{}'::jsonb));
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
end;
$$;

-- Category/attribute/settings changes made by admins are logged automatically.
create or replace function public.audit_admin_table_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  perform public.log_admin_action(
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key'),
    null,
    jsonb_build_object('name', coalesce(v_row ->> 'name', v_row ->> 'label', v_row ->> 'key'))
  );
  return coalesce(new, old);
end;
$$;

create trigger categories_audit after insert or update or delete on public.categories
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();
create trigger category_attributes_audit after insert or update or delete on public.category_attributes
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();
create trigger platform_settings_audit after insert or update or delete on public.platform_settings
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------
create type public.promotion_kind as enum ('featured', 'boost');
create type public.promotion_status as enum ('pending_payment', 'active', 'expired', 'cancelled');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'test');

create table public.promotion_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.promotion_kind not null,
  duration_days integer not null check (duration_days between 1 and 90),
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null default 'GHS',
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.promotion_plans (id) on delete set null,
  kind public.promotion_kind not null,
  amount numeric(12, 2) not null,
  currency char(3) not null default 'GHS',
  duration_days integer not null,
  status public.promotion_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promotions_active_idx on public.promotions (listing_id, kind) where status = 'active';
create index promotions_seller_idx on public.promotions (seller_id, created_at desc);

create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

-- Is a listing currently promoted with a given kind?
create or replace function public.listing_promoted(p_listing uuid, p_kind public.promotion_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.promotions
     where listing_id = p_listing and kind = p_kind and status = 'active'
       and starts_at <= now() and ends_at > now()
  );
$$;

-- Seller requests a promotion; amounts come from the plan, not the client.
create or replace function public.request_promotion(p_listing uuid, p_plan uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.promotion_plans;
  v_id uuid;
begin
  if not public.can_sell() then
    raise exception 'Seller account required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.listings where id = p_listing and seller_id = auth.uid() and status = 'published'
  ) then
    raise exception 'Only your published listings can be promoted' using errcode = '42501';
  end if;
  select * into v_plan from public.promotion_plans where id = p_plan and is_active;
  if v_plan.id is null then
    raise exception 'Promotion plan not available' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.promotions where listing_id = p_listing and kind = v_plan.kind
       and status in ('pending_payment', 'active') and coalesce(ends_at, 'infinity') > now()
  ) then
    raise exception 'This listing already has a pending or active % promotion', v_plan.kind
      using errcode = '23505';
  end if;

  insert into public.promotions (listing_id, seller_id, plan_id, kind, amount, currency, duration_days)
  values (p_listing, auth.uid(), v_plan.id, v_plan.kind, v_plan.price, v_plan.currency, v_plan.duration_days)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_promotion(p_promotion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.promotions set status = 'cancelled'
   where id = p_promotion and seller_id = auth.uid() and status = 'pending_payment';
  if not found then
    raise exception 'Only unpaid promotion requests can be cancelled' using errcode = '42501';
  end if;
end;
$$;

-- Internal: activate a promotion after a verified (or test) payment.
create or replace function public.activate_promotion_internal(p_promotion uuid, p_payment public.payment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promo public.promotions;
begin
  update public.promotions
     set status = 'active', payment_status = p_payment,
         starts_at = now(), ends_at = now() + make_interval(days => duration_days)
   where id = p_promotion and status = 'pending_payment'
  returning * into v_promo;
  if v_promo.id is null then
    return; -- idempotent: already active or cancelled
  end if;
  perform public.notify(v_promo.seller_id, 'promotion',
    'Promotion active',
    'Your ' || v_promo.kind || ' promotion runs for ' || v_promo.duration_days || ' days.',
    '/seller-dashboard/promotions', v_promo.id);
end;
$$;

create or replace function public.expire_promotions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.promotions set status = 'expired' where status = 'active' and ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments (checkout disabled by default; writes only by the server via the
-- service role after provider verification)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  purpose text not null check (purpose in ('promotion')),
  promotion_id uuid references public.promotions (id) on delete set null,
  provider text not null check (provider in ('paystack', 'hubtel')),
  reference text not null unique,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null default 'GHS',
  status public.payment_status not null default 'pending',
  provider_transaction_id text,
  channel text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  status_before public.payment_status,
  status_after public.payment_status,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- ---------------------------------------------------------------------------
-- Admin RPCs (all audited)
-- ---------------------------------------------------------------------------
create or replace function public.admin_moderate_listing(p_listing uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings;
  v_new public.listing_status;
  v_title text;
  v_body text;
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  select * into v_listing from public.listings where id = p_listing for update;
  if v_listing.id is null then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    if v_listing.status not in ('pending_review', 'rejected') then
      raise exception 'Only listings awaiting review can be approved';
    end if;
    v_new := 'published';
    v_title := 'Your listing is live';
    v_body := '"' || v_listing.title || '" was approved and is now visible to buyers.';
  elsif p_action = 'reject' then
    v_new := 'rejected';
    v_title := 'Listing not approved';
    v_body := '"' || v_listing.title || '" was not approved. Reason: ' || coalesce(p_reason, 'policy');
  elsif p_action = 'request_changes' then
    v_new := 'draft';
    v_title := 'Changes requested';
    v_body := 'Please update "' || v_listing.title || '": ' || coalesce(p_reason, '');
  elsif p_action = 'remove' then
    v_new := 'removed';
    v_title := 'Listing removed';
    v_body := '"' || v_listing.title || '" was removed for breaching our rules. Reason: ' || coalesce(p_reason, 'policy');
  elsif p_action = 'restore' then
    if v_listing.status <> 'removed' then
      raise exception 'Only removed listings can be restored';
    end if;
    v_new := 'paused';
    v_title := 'Listing restored';
    v_body := '"' || v_listing.title || '" was restored. You can publish it again from your dashboard.';
  else
    raise exception 'Unknown moderation action';
  end if;

  if p_action in ('reject', 'request_changes', 'remove') and coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  update public.listings
     set status = v_new,
         moderation_note = case when p_action in ('approve', 'restore') then null else p_reason end
   where id = p_listing;

  if p_action in ('remove', 'reject') then
    update public.promotions set status = 'cancelled'
     where listing_id = p_listing and status = 'pending_payment';
  end if;

  perform public.log_admin_action('listing.' || p_action, 'listing', p_listing::text, p_reason,
    jsonb_build_object('title', v_listing.title, 'from', v_listing.status, 'to', v_new));
  perform public.notify(v_listing.seller_id, 'moderation', v_title, v_body,
    '/seller-dashboard/listings', p_listing);
end;
$$;

create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  if p_user = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;
  if p_status = 'suspended' and coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to suspend an account' using errcode = '22023';
  end if;
  update public.profiles
     set status = p_status,
         suspended_reason = case when p_status = 'suspended' then p_reason else null end
   where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('user.' || p_status::text, 'user', p_user::text, p_reason);
  if p_status = 'active' then
    perform public.notify(p_user, 'account', 'Account reinstated',
      'Your QuestHub account is active again.', '/account', null);
  end if;
end;
$$;

create or replace function public.admin_set_user_role(p_user uuid, p_role public.user_role, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('user.role_' || p_role::text, 'user', p_user::text, p_reason);
end;
$$;

-- Verification must reflect a real check performed by staff (ID, business
-- registration, etc.). The reason records what was verified.
create or replace function public.admin_set_verified(p_user uuid, p_verified boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  if p_verified and coalesce(trim(p_reason), '') = '' then
    raise exception 'Record what was verified' using errcode = '22023';
  end if;
  update public.profiles
     set is_verified = p_verified, verified_at = case when p_verified then now() else null end
   where id = p_user;
  perform public.log_admin_action(case when p_verified then 'user.verified' else 'user.unverified' end,
    'user', p_user::text, p_reason);
  if p_verified then
    perform public.notify(p_user, 'account', 'You are now a verified seller',
      'Buyers will see a verified badge on your profile.', '/account', null);
  end if;
end;
$$;

create or replace function public.admin_update_report(p_report uuid, p_status public.report_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  update public.reports
     set status = p_status,
         resolution_note = coalesce(nullif(trim(p_note), ''), resolution_note),
         resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() else resolved_by end,
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() else resolved_at end
   where id = p_report
  returning * into v_report;
  if v_report.id is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('report.' || p_status::text, 'report', p_report::text, p_note,
    jsonb_build_object('reason', v_report.reason, 'target_type', v_report.target_type));
  if p_status in ('resolved', 'dismissed') then
    perform public.notify(v_report.reporter_id, 'report', 'Your report was reviewed',
      'Thanks for helping keep QuestHub safe. Our team has reviewed your report.', '/notifications', p_report);
  end if;
end;
$$;

-- Admins can read a reported message (and only reported ones).
create or replace function public.admin_reported_message(p_report uuid)
returns table (body text, created_at timestamptz, sender_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select m.body, m.created_at, m.sender_id
      from public.reports r join public.messages m on m.id = r.message_id
     where r.id = p_report;
end;
$$;

create or replace function public.admin_set_review_hidden(p_review uuid, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  update public.reviews set is_hidden = p_hidden where id = p_review;
  perform public.log_admin_action(case when p_hidden then 'review.hidden' else 'review.shown' end,
    'review', p_review::text, p_reason);
end;
$$;

-- Test-mode activation: only allowed while promotions_test_mode is on. The
-- promotion is stored with payment_status = 'test', never 'paid'.
create or replace function public.admin_activate_promotion_test(p_promotion uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  if not coalesce((public.setting('promotions_test_mode'))::boolean, false) then
    raise exception 'Test-mode activation is disabled' using errcode = '42501';
  end if;
  perform public.activate_promotion_internal(p_promotion, 'test');
  perform public.log_admin_action('promotion.activate_test', 'promotion', p_promotion::text, p_reason);
end;
$$;

create or replace function public.admin_cancel_promotion(p_promotion uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.trust(); -- trusted for the rest of this request
  update public.promotions set status = 'cancelled'
   where id = p_promotion and status in ('pending_payment', 'active');
  perform public.log_admin_action('promotion.cancel', 'promotion', p_promotion::text, p_reason);
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_sellers', (select count(distinct seller_id) from public.listings where status = 'published'),
    'suspended_users', (select count(*) from public.profiles where status = 'suspended'),
    'published_listings', (select count(*) from public.listings where status = 'published'),
    'pending_review', (select count(*) from public.listings where status = 'pending_review'),
    'sold_listings', (select count(*) from public.listings where status = 'sold'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'active_promotions', (select count(*) from public.promotions where status = 'active' and ends_at > now()),
    'promotion_revenue_paid', (select coalesce(sum(amount), 0) from public.payments where status = 'paid'),
    'listings_by_category', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.count desc), '[]'::jsonb) from (
        select coalesce(p.name, c.name) as name, count(*) as count
          from public.listings l
          join public.categories c on c.id = l.category_id
          left join public.categories p on p.id = c.parent_id
         where l.status = 'published'
         group by 1
      ) t
    ),
    'signups_by_day', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb) from (
        select d::date as day,
               (select count(*) from public.profiles p
                 where (p.created_at at time zone 'Africa/Accra')::date = d::date) as count
          from generate_series(now() - interval '13 days', now(), interval '1 day') d
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(
  p_query text default null,
  p_category uuid default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_region smallint default null,
  p_condition public.listing_condition default null,
  p_attrs jsonb default '{}'::jsonb,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0,
  p_featured_only boolean default false
)
returns table (
  id uuid, slug text, title text, price numeric, currency char(3), is_negotiable boolean,
  condition public.listing_condition, city text, region_name text, published_at timestamptz,
  status public.listing_status, seller_id uuid, seller_verified boolean, cover_path text,
  is_boosted boolean, is_featured boolean, total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with q as (
    select case when nullif(trim(p_query), '') is null then null
                else websearch_to_tsquery('english', trim(p_query)) end as tsq,
           nullif(trim(p_query), '') as raw,
           replace(replace(replace(nullif(trim(p_query), ''), '\', '\\'), '%', '\%'), '_', '\_') as escaped
  ),
  base as (
    select l.*,
           public.listing_promoted(l.id, 'boost') as boosted,
           public.listing_promoted(l.id, 'featured') as featured,
           case when q.tsq is null then 0
                else ts_rank(l.search_vector, q.tsq) + extensions.similarity(l.title, q.raw) end as rank
      from public.listings l, q
     where l.status = 'published'
       and (l.expires_at is null or l.expires_at > now())
       and (q.raw is null or l.search_vector @@ q.tsq or l.title ilike '%' || q.escaped || '%')
       and (p_category is null or l.category_id in (select public.category_descendants(p_category)))
       and (p_min_price is null or l.price >= p_min_price)
       and (p_max_price is null or l.price <= p_max_price)
       and (p_region is null or l.region_id = p_region)
       and (p_condition is null or l.condition = p_condition)
       and not exists (
         select 1 from jsonb_each_text(coalesce(p_attrs, '{}'::jsonb)) f
          where not exists (
            select 1 from public.listing_attribute_values v
              join public.category_attributes a on a.id = v.attribute_id
             where v.listing_id = l.id
               and (
                 (a.key = f.key and lower(coalesce(v.value_text, v.value_bool::text, v.value_number::text)) = lower(f.value))
                 or (f.key = a.key || '_min' and v.value_number >= (f.value)::numeric)
                 or (f.key = a.key || '_max' and v.value_number <= (f.value)::numeric)
               )
          )
       )
  )
  select b.id, b.slug, b.title, b.price, b.currency, b.is_negotiable, b.condition, b.city,
         r.name, b.published_at, b.status, b.seller_id, p.is_verified,
         (select i.storage_path from public.listing_images i where i.listing_id = b.id
           order by i.sort_order, i.created_at limit 1),
         b.boosted, b.featured, count(*) over ()
    from base b
    left join public.regions r on r.id = b.region_id
    join public.profiles p on p.id = b.seller_id and p.status = 'active'
   where (not p_featured_only or b.featured)
   order by
     case when p_sort in ('relevance', 'newest') and b.boosted then 0 else 1 end,
     case when p_sort = 'price_asc' then b.price end asc nulls last,
     case when p_sort = 'price_desc' then b.price end desc nulls last,
     case when p_sort = 'relevance' then b.rank end desc,
     b.published_at desc
   limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

create or replace function public.search_suggestions(p_query text)
returns table (kind text, label text, slug text)
language sql
stable
set search_path = ''
as $$
  (select 'category', c.name, c.slug from public.categories c
    where c.is_active and c.name ilike '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%'
    order by c.parent_id nulls first, c.name limit 3)
  union all
  (select 'listing', t.title, null from (
     select distinct on (lower(l.title)) l.title, extensions.similarity(l.title, p_query) as s
       from public.listings l
      where l.status = 'published' and (l.expires_at is null or l.expires_at > now())
        and (l.title operator(extensions.%) p_query or l.title ilike '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%')
      order by lower(l.title), s desc
   ) t order by t.s desc limit 5);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_actions enable row level security;
alter table public.promotion_plans enable row level security;
alter table public.promotions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

create policy "audit admin read" on public.admin_actions for select to authenticated
  using (public.is_admin());

create policy "plans readable" on public.promotion_plans for select using (is_active or public.is_admin());
create policy "plans admin insert" on public.promotion_plans for insert to authenticated
  with check (public.is_admin());
create policy "plans admin update" on public.promotion_plans for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "promotions owner read" on public.promotions for select to authenticated
  using (seller_id = auth.uid() or public.is_admin());

-- Payments: owners read their own; no client writes at all (service role only).
create policy "payments owner read" on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "payment events admin read" on public.payment_events for select to authenticated
  using (public.is_admin());

create trigger promotion_plans_audit after insert or update or delete on public.promotion_plans
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();

-- Function privileges
revoke execute on function public.log_admin_action(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.activate_promotion_internal(uuid, public.payment_status) from public, anon, authenticated;
revoke execute on function public.expire_promotions() from public, anon, authenticated;
revoke execute on function public.request_promotion(uuid, uuid) from public, anon;
revoke execute on function public.cancel_promotion(uuid) from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'admin_moderate_listing(uuid, text, text)',
    'admin_set_user_status(uuid, public.account_status, text)',
    'admin_set_user_role(uuid, public.user_role, text)',
    'admin_set_verified(uuid, boolean, text)',
    'admin_update_report(uuid, public.report_status, text)',
    'admin_reported_message(uuid)',
    'admin_set_review_hidden(uuid, boolean, text)',
    'admin_activate_promotion_test(uuid, text)',
    'admin_cancel_promotion(uuid, text)',
    'admin_dashboard_stats()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under <uid>/..., so users can only write in their own folder.
create policy "questhub images owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );
create policy "questhub images owner update" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "questhub images owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "questhub images owner list" on storage.objects for select to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime (RLS applies to postgres_changes subscriptions)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

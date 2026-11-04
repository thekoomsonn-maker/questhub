-- Business dashboard: staff levels, sales and vendor analytics, homepage banners.
-- Written to add only (no drops), so it applies cleanly on a live database.

-- ---------------------------------------------------------------------------
-- Staff levels. Every admin (role = 'admin') is staff; the level narrows what
-- they can do. An admin with no level is treated as owner, so existing
-- admins keep full access.
--   owner:     everything, including staff, settings and payments
--   manager:   store, orders, vendors, promotions, banners, categories, reports
--   moderator: listings, reports, users and shops (trust & safety)
-- ---------------------------------------------------------------------------
create type public.staff_level as enum ('owner', 'manager', 'moderator');

alter table public.profiles add column staff_level public.staff_level;

create or replace function public.my_staff_level()
returns public.staff_level
language sql
stable
security definer
set search_path = ''
as $$
  select case when role = 'admin' and status = 'active' then coalesce(staff_level, 'owner'::public.staff_level) end
    from public.profiles where id = auth.uid();
$$;

-- Areas: 'safety' (listings, reports, users, shops), 'commerce' (store,
-- orders, bundles, promotions, banners, categories, vendor stats),
-- 'insights' (sales dashboard, exports), 'owner' (staff, settings, payments).
create or replace function public.staff_can(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(case public.my_staff_level()
    when 'owner' then true
    when 'manager' then p_area in ('safety', 'commerce', 'insights')
    when 'moderator' then p_area = 'safety'
  end, false);
$$;

create or replace function public.require_staff(p_area text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_can(p_area) then
    raise exception 'Your staff role does not allow this' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.my_staff_level() to authenticated;
grant execute on function public.staff_can(text) to authenticated;

-- staff_level joins the fields a user can never change on their own profile.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_client_call() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.is_verified is distinct from old.is_verified
       or new.verified_at is distinct from old.verified_at
       or new.suspended_reason is distinct from old.suspended_reason
       or new.created_at is distinct from old.created_at
       or new.staff_level is distinct from old.staff_level
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change protected profile fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Owner-only: promote someone to staff, change their level, or remove them.
create or replace function public.admin_set_staff(p_user uuid, p_level public.staff_level, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  perform public.require_staff('owner');
  perform public.trust();
  if p_user = auth.uid() then
    raise exception 'You cannot change your own staff role' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_user for update;
  if v_target.id is null then raise exception 'User not found' using errcode = 'P0002'; end if;
  if v_target.status <> 'active' then raise exception 'Reinstate this account first' using errcode = '22023'; end if;

  if p_level is null then
    update public.profiles
       set staff_level = null,
           role = case when exists (select 1 from public.listings l where l.seller_id = p_user) then 'seller'::public.user_role else 'buyer'::public.user_role end
     where id = p_user;
  else
    update public.profiles set role = 'admin', staff_level = p_level where id = p_user;
  end if;
  perform public.log_admin_action(case when p_level is null then 'staff.removed' else 'staff.' || p_level::text end,
    'user', p_user::text, p_reason, jsonb_build_object('name', v_target.display_name));
  if p_level is not null then
    perform public.notify(p_user, 'account', 'You were added to the QuestHub team',
      'Your staff role is ' || p_level::text || '. Open the admin area from your account menu.', '/admin', null);
  end if;
end;
$$;

-- Owner-only lookup by email so the owner can add staff who already have an account.
create or replace function public.admin_find_user_by_email(p_email text)
returns table (id uuid, display_name text, role public.user_role, staff_level public.staff_level, status public.account_status)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff('owner');
  return query
    select p.id, p.display_name, p.role, p.staff_level, p.status
      from public.profiles p join auth.users u on u.id = p.id
     where lower(u.email) = lower(trim(p_email))
     limit 1;
end;
$$;

create or replace function public.admin_list_staff()
returns table (id uuid, email text, display_name text, staff_level public.staff_level, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff('owner');
  return query
    select p.id, u.email::text, p.display_name, coalesce(p.staff_level, 'owner'::public.staff_level), u.last_sign_in_at, p.created_at
      from public.profiles p join auth.users u on u.id = p.id
     where p.role = 'admin'
     order by coalesce(p.staff_level, 'owner'::public.staff_level), p.display_name;
end;
$$;

revoke execute on function public.admin_set_staff(uuid, public.staff_level, text) from public, anon;
grant execute on function public.admin_set_staff(uuid, public.staff_level, text) to authenticated;
revoke execute on function public.admin_find_user_by_email(text) from public, anon;
grant execute on function public.admin_find_user_by_email(text) to authenticated;
revoke execute on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- Role changes are now owner-only (a moderator must not be able to mint admins).
create or replace function public.admin_set_user_role(p_user uuid, p_role public.user_role, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_staff('owner');
  perform public.trust();
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if p_role = 'admin' then
    raise exception 'Add staff from the Staff page so they get a staff level' using errcode = '22023';
  end if;
  update public.profiles set role = p_role, staff_level = null where id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('user.role_' || p_role::text, 'user', p_user::text, p_reason);
end;
$$;

-- Order handling needs commerce rights.
create or replace function public.admin_retry_topup(p_order uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_staff('commerce');
  update public.orders set topup_status = 'sending', status = 'paid'
   where id = p_order and kind = 'topup' and topup_status = 'failed' and payment_status in ('paid', 'test') and status = 'refund_due';
  if not found then raise exception 'Only failed, paid top-ups can be retried'; end if;
  perform public.log_order_event(p_order, 'paid', 'Retry requested: ' || coalesce(p_note, ''));
  perform public.log_admin_action('order.topup_retry', 'order', p_order::text, p_note);
end;
$$;

create or replace function public.admin_update_order(p_order uuid, p_status public.order_status, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_allowed boolean;
begin
  perform public.require_staff('commerce');
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  v_allowed := (v_order.status, p_status) in (
    ('paid', 'processing'), ('processing', 'shipped'), ('shipped', 'delivered'), ('paid', 'shipped'),
    ('paid', 'refund_due'), ('processing', 'refund_due'), ('refund_due', 'refunded'),
    ('pending_payment', 'cancelled'), ('failed', 'refund_due')
  ) or (v_order.kind = 'topup' and (v_order.status, p_status) in (('refund_due', 'delivered')));
  if not v_allowed then
    raise exception 'Can''t move an order from % to %', v_order.status, p_status;
  end if;
  if p_status in ('refund_due', 'refunded', 'cancelled') and coalesce(trim(p_note), '') = '' then
    raise exception 'Add a note explaining this change' using errcode = '22023';
  end if;
  update public.orders set status = p_status, staff_note = coalesce(nullif(trim(p_note), ''), staff_note) where id = p_order;
  if p_status = 'cancelled' then
    update public.store_products p set stock = p.stock + i.quantity
      from public.order_items i where i.order_id = p_order and p.id = i.product_id;
  end if;
  perform public.log_order_event(p_order, p_status::text, p_note);
  perform public.log_admin_action('order.' || p_status::text, 'order', v_order.order_number, p_note);
  perform public.notify(v_order.user_id, 'order', 'Order ' || v_order.order_number || ' update',
    case p_status
      when 'processing' then 'We''re packing your order.'
      when 'shipped' then 'Your order is on its way.'
      when 'delivered' then 'Your order was delivered. Enjoy!'
      when 'refunded' then 'Your refund has been sent.'
      when 'refund_due' then 'We''ll refund your payment shortly.'
      else 'Your order status changed to ' || p_status::text || '.'
    end, '/orders/' || v_order.id, v_order.id);
end;
$$;

-- Restrictive policies narrow the existing "admin can write" policies by area.
-- (Restrictive policies are ANDed with the permissive ones, so nothing is dropped.)
create policy "settings owner insert" on public.platform_settings as restrictive for insert to authenticated with check (public.staff_can('owner'));
create policy "settings owner update" on public.platform_settings as restrictive for update to authenticated using (public.staff_can('owner'));
create policy "settings owner delete" on public.platform_settings as restrictive for delete to authenticated using (public.staff_can('owner'));
create policy "products commerce staff" on public.store_products as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "products commerce staff update" on public.store_products as restrictive for update to authenticated using (public.staff_can('commerce'));
create policy "products commerce staff delete" on public.store_products as restrictive for delete to authenticated using (public.staff_can('commerce'));
create policy "product images commerce staff" on public.store_product_images as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "product images commerce staff delete" on public.store_product_images as restrictive for delete to authenticated using (public.staff_can('commerce'));
create policy "bundles commerce staff" on public.topup_bundles as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "bundles commerce staff update" on public.topup_bundles as restrictive for update to authenticated using (public.staff_can('commerce'));
create policy "categories commerce staff" on public.categories as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "categories commerce staff update" on public.categories as restrictive for update to authenticated using (public.staff_can('commerce'));
create policy "categories commerce staff delete" on public.categories as restrictive for delete to authenticated using (public.staff_can('commerce'));
create policy "attributes commerce staff" on public.category_attributes as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "attributes commerce staff update" on public.category_attributes as restrictive for update to authenticated using (public.staff_can('commerce'));
create policy "attributes commerce staff delete" on public.category_attributes as restrictive for delete to authenticated using (public.staff_can('commerce'));
create policy "plans commerce staff" on public.promotion_plans as restrictive for insert to authenticated with check (public.staff_can('commerce'));
create policy "plans commerce staff update" on public.promotion_plans as restrictive for update to authenticated using (public.staff_can('commerce'));
-- Payment records are owner-only to read for staff; customers still see their own.
create policy "payments staff owner" on public.payments as restrictive for select to authenticated
  using (user_id = auth.uid() or public.staff_can('owner'));
create policy "payment events owner" on public.payment_events as restrictive for select to authenticated
  using (public.staff_can('owner'));

-- ---------------------------------------------------------------------------
-- Sales analytics (managers and owners). Money counts only verified payments
-- ('paid'); test payments are reported separately so they never inflate
-- revenue. Days are Accra local days.
-- ---------------------------------------------------------------------------
create or replace function public.admin_sales_report(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from timestamptz := date_trunc('day', now() at time zone 'Africa/Accra') at time zone 'Africa/Accra' - make_interval(days => v_days - 1);
  v_prev_from timestamptz := v_from - make_interval(days => v_days);
begin
  perform public.require_staff('insights');
  return jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'totals', (
      select jsonb_build_object(
        'store_revenue', coalesce(sum(total) filter (where kind = 'goods'), 0),
        'topup_revenue', coalesce(sum(total) filter (where kind = 'topup'), 0),
        'orders', count(*),
        'goods_orders', count(*) filter (where kind = 'goods'),
        'topup_orders', count(*) filter (where kind = 'topup'),
        'avg_order', coalesce(round(avg(total) filter (where kind = 'goods'), 2), 0),
        'customers', count(distinct user_id)
      ) from public.orders where payment_status = 'paid' and paid_at >= v_from
    ),
    'previous', (
      select jsonb_build_object(
        'store_revenue', coalesce(sum(total) filter (where kind = 'goods'), 0),
        'topup_revenue', coalesce(sum(total) filter (where kind = 'topup'), 0),
        'orders', count(*)
      ) from public.orders where payment_status = 'paid' and paid_at >= v_prev_from and paid_at < v_from
    ),
    'test_orders', (select count(*) from public.orders where payment_status = 'test' and paid_at >= v_from),
    'promotion_revenue', (
      select coalesce(sum(amount), 0) from public.payments where purpose = 'promotion' and status = 'paid' and verified_at >= v_from
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'store', d.store, 'topups', d.topups, 'orders', d.orders) order by d.day), '[]'::jsonb)
        from (
          select g::date as day,
                 coalesce(sum(o.total) filter (where o.kind = 'goods'), 0) as store,
                 coalesce(sum(o.total) filter (where o.kind = 'topup'), 0) as topups,
                 count(o.id) as orders
            from generate_series((v_from at time zone 'Africa/Accra')::date, (now() at time zone 'Africa/Accra')::date, interval '1 day') g
            left join public.orders o
              on o.payment_status = 'paid' and (o.paid_at at time zone 'Africa/Accra')::date = g::date
           group by g
        ) d
    ),
    'status_counts', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status::text, count(*) as n from public.orders where created_at >= v_from group by status) s
    ),
    'needs_attention', jsonb_build_object(
      'to_ship', (select count(*) from public.orders where kind = 'goods' and status in ('paid', 'processing')),
      'refunds_due', (select count(*) from public.orders where status = 'refund_due'),
      'low_stock', (select count(*) from public.store_products where is_active and stock <= 3)
    ),
    'top_products', (
      select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) from (
        select i.product_name as name, sum(i.quantity) as units, sum(i.line_total) as revenue
          from public.order_items i join public.orders o on o.id = i.order_id
         where o.payment_status = 'paid' and o.paid_at >= v_from
         group by i.product_name
         order by sum(i.line_total) desc
         limit 8
      ) t
    ),
    'topups_by_network', (
      select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) from (
        select topup_network::text as network, topup_type as type, count(*) as orders, sum(total) as revenue,
               count(*) filter (where topup_status = 'delivered') as delivered
          from public.orders
         where kind = 'topup' and payment_status = 'paid' and paid_at >= v_from
         group by topup_network, topup_type
      ) t
    ),
    'marketplace', jsonb_build_object(
      'new_users', (select count(*) from public.profiles where created_at >= v_from),
      'new_listings', (select count(*) from public.listings where created_at >= v_from),
      'published_now', (select count(*) from public.listings where status = 'published'),
      'sold', (select count(*) from public.listings where sold_at >= v_from),
      'conversations', (select count(*) from public.conversations where created_at >= v_from),
      'new_shops', (select count(*) from public.shops where created_at >= v_from),
      'active_shops', (select count(*) from public.shops where status = 'active')
    )
  );
end;
$$;

-- Vendor performance (managers and owners). Vendor money is paid to vendors
-- directly; "sales" here is the value of completed vendor orders.
create or replace function public.admin_vendor_report(p_days integer default 30)
returns table (
  shop_id uuid, slug text, name text, status public.shop_status, is_verified boolean, featured_until timestamptz,
  orders bigint, completed bigint, declined bigint, cancelled bigint, open_orders bigint,
  sales numeric, completion_rate numeric, median_confirm_minutes numeric, live_listings bigint, orderable_listings bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  perform public.require_staff('commerce');
  return query
    select s.id, s.slug, s.name, s.status, s.is_verified, s.featured_until,
           count(o.id),
           count(o.id) filter (where o.status = 'completed'),
           count(o.id) filter (where o.status = 'declined'),
           count(o.id) filter (where o.status = 'cancelled'),
           count(o.id) filter (where o.status in ('requested', 'confirmed', 'out_for_delivery', 'ready_for_pickup')),
           coalesce(sum(o.subtotal) filter (where o.status = 'completed'), 0),
           case when count(o.id) filter (where o.status in ('completed', 'declined', 'cancelled')) = 0 then null
                else round(100.0 * count(o.id) filter (where o.status = 'completed')
                           / count(o.id) filter (where o.status in ('completed', 'declined', 'cancelled')), 1) end,
           (select round((percentile_cont(0.5) within group (order by extract(epoch from (e.created_at - vo.created_at)) / 60))::numeric, 0)
              from public.vendor_orders vo
              join public.vendor_order_events e on e.order_id = vo.id and e.status = 'confirmed'
             where vo.shop_id = s.id and vo.created_at >= v_from),
           (select count(*) from public.listings l where l.seller_id = s.owner_id and l.status = 'published'),
           (select count(*) from public.listings l where l.seller_id = s.owner_id and l.status = 'published' and l.orderable)
      from public.shops s
      left join public.vendor_orders o on o.shop_id = s.id and o.created_at >= v_from
     group by s.id
     order by coalesce(sum(o.subtotal) filter (where o.status = 'completed'), 0) desc, count(o.id) desc, s.name;
end;
$$;

revoke execute on function public.admin_sales_report(integer) from public, anon;
grant execute on function public.admin_sales_report(integer) to authenticated;
revoke execute on function public.admin_vendor_report(integer) from public, anon;
grant execute on function public.admin_vendor_report(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Homepage and store banners, managed by commerce staff.
-- ---------------------------------------------------------------------------
create type public.banner_placement as enum ('home', 'store');
create type public.banner_tone as enum ('brand', 'gold', 'ink');

create table public.site_banners (
  id uuid primary key default gen_random_uuid(),
  placement public.banner_placement not null default 'home',
  title text not null check (char_length(title) between 3 and 80),
  body text check (char_length(body) <= 200),
  link_url text check (link_url is null or link_url ~ '^(/[^/]|https://)'),
  link_label text check (char_length(link_label) <= 30),
  tone public.banner_tone not null default 'brand',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check ((link_url is null) = (link_label is null))
);
create index site_banners_live_idx on public.site_banners (placement, sort_order) where is_active;
create trigger site_banners_updated_at before update on public.site_banners
  for each row execute function public.set_updated_at();

alter table public.site_banners enable row level security;
create policy "banners public read" on public.site_banners for select
  using ((is_active and starts_at <= now() and (ends_at is null or ends_at > now())) or public.staff_can('commerce'));
create policy "banners staff insert" on public.site_banners for insert to authenticated with check (public.staff_can('commerce'));
create policy "banners staff update" on public.site_banners for update to authenticated using (public.staff_can('commerce')) with check (public.staff_can('commerce'));
create policy "banners staff delete" on public.site_banners for delete to authenticated using (public.staff_can('commerce'));
create trigger site_banners_audit after insert or update or delete on public.site_banners
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();

-- Exports leave a trace in the audit log (who downloaded what, and how much).
create or replace function public.log_export(p_kind text, p_days integer, p_rows integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  perform public.log_admin_action('export.' || left(p_kind, 30), 'export', p_kind, null,
    jsonb_build_object('days', p_days, 'rows', p_rows));
end;
$$;
revoke execute on function public.log_export(text, integer, integer) from public, anon;
grant execute on function public.log_export(text, integer, integer) to authenticated;

-- Vendor shops: a storefront per seller, buy-online listings, a per-shop cart
-- and orders that are paid directly to the vendor (pay on delivery or to the
-- vendor's own Mobile Money). QuestHub never holds vendor money.

create type public.shop_status as enum ('pending', 'active', 'suspended');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text check (char_length(tagline) <= 120),
  about text check (char_length(about) <= 2000),
  logo_path text,
  banner_path text,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{9,16}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{9,16}$'),
  region_id smallint references public.regions (id),
  city text check (char_length(city) <= 80),
  address text check (char_length(address) <= 200),
  opening_hours text check (char_length(opening_hours) <= 300),
  delivery_info text check (char_length(delivery_info) <= 500),
  accepts_pay_on_delivery boolean not null default true,
  accepts_momo boolean not null default false,
  momo_number text check (momo_number is null or momo_number ~ '^0[2-5][0-9]{8}$'),
  momo_name text check (char_length(momo_name) <= 80),
  status public.shop_status not null default 'pending',
  status_reason text,
  is_verified boolean not null default false,
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepts_pay_on_delivery or accepts_momo),
  check (not accepts_momo or (momo_number is not null and momo_name is not null))
);

create index shops_status_idx on public.shops (status, created_at desc);
create index shops_region_idx on public.shops (region_id) where status = 'active';

create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, description) values
  ('shops_require_approval', 'true', 'When true, new shops wait for an admin before they appear publicly.')
on conflict (key) do nothing;

-- Owners can't change moderation fields; new shops start pending (or active if approval is off).
create or replace function public.shops_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_client_call() then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid();
      new.status := case when coalesce((public.setting('shops_require_approval'))::boolean, true) then 'pending'::public.shop_status else 'active'::public.shop_status end;
      new.is_verified := false;
      new.featured_until := null;
      new.status_reason := null;
      if not public.can_sell() then
        raise exception 'Switch on selling before opening a shop' using errcode = '42501';
      end if;
    elsif new.owner_id is distinct from old.owner_id or new.status is distinct from old.status
       or new.is_verified is distinct from old.is_verified or new.featured_until is distinct from old.featured_until
       or new.status_reason is distinct from old.status_reason then
      raise exception 'Not allowed to change protected shop fields' using errcode = '42501';
    end if;
  end if;
  new.slug := lower(new.slug);
  return new;
end;
$$;

create trigger shops_guard before insert or update on public.shops
  for each row execute function public.shops_guard();

create or replace function public.shop_is_public(s public.shops)
returns boolean language sql stable set search_path = '' as $$
  select s.status = 'active' and exists (select 1 from public.profiles p where p.id = s.owner_id and p.status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- Buy-online listings
-- ---------------------------------------------------------------------------
alter table public.listings add column orderable boolean not null default false;
-- Quantity can reach 0 when the last item is reserved by an order (shown as sold out).
alter table public.listings drop constraint listings_quantity_check;
alter table public.listings add constraint listings_quantity_check check (quantity between 0 and 100000);

create or replace function public.listings_orderable_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.orderable and (tg_op = 'INSERT' or not old.orderable) and not exists (
    select 1 from public.shops s where s.owner_id = new.seller_id and s.status = 'active'
  ) then
    raise exception 'Open your shop (and have it approved) to sell online' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger listings_orderable_guard before insert or update of orderable on public.listings
  for each row execute function public.listings_orderable_guard();

-- ---------------------------------------------------------------------------
-- Shop cart and orders
-- ---------------------------------------------------------------------------
create table public.shop_cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 50),
  added_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create type public.vendor_order_status as enum
  ('requested', 'confirmed', 'out_for_delivery', 'ready_for_pickup', 'completed', 'declined', 'cancelled');
create type public.vendor_payment_method as enum ('pay_on_delivery', 'momo_to_vendor');

create sequence public.vendor_order_number_seq start 500001;

create table public.vendor_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('VO' || nextval('public.vendor_order_number_seq')),
  shop_id uuid not null references public.shops (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  status public.vendor_order_status not null default 'requested',
  payment_method public.vendor_payment_method not null,
  buyer_marked_paid boolean not null default false,
  vendor_confirmed_payment boolean not null default false,
  subtotal numeric(12, 2) not null check (subtotal > 0),
  buyer_name text not null,
  buyer_phone text not null,
  delivery_region_id smallint references public.regions (id),
  delivery_city text,
  delivery_address text,
  buyer_note text check (char_length(buyer_note) <= 500),
  vendor_note text check (char_length(vendor_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendor_orders_shop_idx on public.vendor_orders (shop_id, status, created_at desc);
create index vendor_orders_buyer_idx on public.vendor_orders (buyer_id, created_at desc);
create trigger vendor_orders_updated_at before update on public.vendor_orders
  for each row execute function public.set_updated_at();

create table public.vendor_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.vendor_orders (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  title text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) generated always as (unit_price * quantity) stored
);
create index vendor_order_items_order_idx on public.vendor_order_items (order_id);

create table public.vendor_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.vendor_orders (id) on delete cascade,
  status text not null,
  note text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index vendor_order_events_idx on public.vendor_order_events (order_id, created_at);

-- Place an order with one shop from the buyer's shop cart. Reserves quantity.
create or replace function public.place_shop_order(
  p_shop uuid, p_payment public.vendor_payment_method, p_name text, p_phone text,
  p_region smallint default null, p_city text default null, p_address text default null, p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_shop public.shops;
  v_subtotal numeric := 0;
  v_order uuid;
  v_prev text;
  r record;
begin
  if v_user is null or not public.is_active_user() then
    raise exception 'Sign in with an active account to order' using errcode = '42501';
  end if;
  select * into v_shop from public.shops s where s.id = p_shop and public.shop_is_public(s);
  if v_shop.id is null then raise exception 'This shop is not taking orders' using errcode = 'P0001'; end if;
  if v_shop.owner_id = v_user then raise exception 'You can''t order from your own shop' using errcode = '22023'; end if;
  if public.is_blocked_between(v_user, v_shop.owner_id) then raise exception 'You can''t order from this shop' using errcode = '42501'; end if;
  if (p_payment = 'pay_on_delivery' and not v_shop.accepts_pay_on_delivery) or (p_payment = 'momo_to_vendor' and not v_shop.accepts_momo) then
    raise exception 'This shop doesn''t accept that payment method' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or trim(coalesce(p_phone, '')) !~ '^(\+233|0)[235][0-9]{8}$' then
    raise exception 'Enter your name and a Ghana phone number' using errcode = '22023';
  end if;
  if (select count(*) from public.vendor_orders where buyer_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many orders in the last hour. Try again later.' using errcode = 'P0001';
  end if;

  for r in
    select c.listing_id, c.quantity, l.title, l.price, l.quantity as stock, l.status, l.orderable, l.expires_at
      from public.shop_cart_items c join public.listings l on l.id = c.listing_id
     where c.user_id = v_user and l.seller_id = v_shop.owner_id
     order by c.listing_id
       for update of l
  loop
    if r.status <> 'published' or not r.orderable or r.price is null or (r.expires_at is not null and r.expires_at < now()) then
      raise exception '"%" can''t be ordered right now. Remove it from your cart.', r.title using errcode = 'P0001';
    end if;
    if r.stock < r.quantity then
      raise exception 'Only % of "%" available', r.stock, r.title using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + r.price * r.quantity;
  end loop;
  if v_subtotal = 0 then raise exception 'Your cart has nothing from this shop' using errcode = 'P0001'; end if;

  insert into public.vendor_orders (shop_id, buyer_id, payment_method, subtotal, buyer_name, buyer_phone,
                                    delivery_region_id, delivery_city, delivery_address, buyer_note)
  values (v_shop.id, v_user, p_payment, v_subtotal, trim(p_name), regexp_replace(p_phone, '\s', '', 'g'),
          p_region, nullif(trim(p_city), ''), nullif(trim(p_address), ''), nullif(left(trim(p_note), 500), ''))
  returning id into v_order;

  insert into public.vendor_order_items (order_id, listing_id, title, unit_price, quantity)
  select v_order, l.id, l.title, l.price, c.quantity
    from public.shop_cart_items c join public.listings l on l.id = c.listing_id
   where c.user_id = v_user and l.seller_id = v_shop.owner_id;

  v_prev := public.trust();
  update public.listings l set quantity = l.quantity - c.quantity
    from public.shop_cart_items c
   where c.user_id = v_user and c.listing_id = l.id and l.seller_id = v_shop.owner_id;
  perform public.untrust(v_prev);

  delete from public.shop_cart_items c using public.listings l
   where c.user_id = v_user and l.id = c.listing_id and l.seller_id = v_shop.owner_id;

  insert into public.vendor_order_events (order_id, status, note, actor_id) values (v_order, 'requested', 'Order placed', v_user);
  perform public.notify(v_shop.owner_id, 'shop_order', 'New order from ' || trim(p_name),
    'GH₵ ' || v_subtotal || ' · ' || case when p_payment = 'pay_on_delivery' then 'pay on delivery' else 'MoMo to you' end || '. Confirm it in your dashboard.',
    '/seller-dashboard/orders', v_order);
  return v_order;
end;
$$;

-- Restores reserved quantity (internal).
create or replace function public.restock_vendor_order(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prev text := public.trust();
begin
  update public.listings l set quantity = least(l.quantity + i.quantity, 100000)
    from public.vendor_order_items i where i.order_id = p_order and l.id = i.listing_id;
  perform public.untrust(v_prev);
end;
$$;

-- Vendor moves an order through fulfilment.
create or replace function public.vendor_update_order(p_order uuid, p_status public.vendor_order_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.vendor_orders;
  v_owner uuid;
begin
  select o.* into v_order from public.vendor_orders o where o.id = p_order for update;
  select owner_id into v_owner from public.shops where id = v_order.shop_id;
  if v_order.id is null or v_owner is distinct from auth.uid() or not public.is_active_user() then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if not (v_order.status, p_status) in (
    ('requested', 'confirmed'), ('requested', 'declined'),
    ('confirmed', 'out_for_delivery'), ('confirmed', 'ready_for_pickup'), ('confirmed', 'cancelled'),
    ('out_for_delivery', 'completed'), ('ready_for_pickup', 'completed'),
    ('out_for_delivery', 'cancelled'), ('ready_for_pickup', 'cancelled')
  ) then
    raise exception 'Can''t move this order from % to %', v_order.status, p_status using errcode = '22023';
  end if;
  if p_status in ('declined', 'cancelled') and coalesce(trim(p_note), '') = '' then
    raise exception 'Tell the buyer why' using errcode = '22023';
  end if;

  update public.vendor_orders set status = p_status, vendor_note = coalesce(nullif(trim(p_note), ''), vendor_note),
         vendor_confirmed_payment = vendor_confirmed_payment or p_status = 'completed'
   where id = p_order;
  if p_status in ('declined', 'cancelled') then perform public.restock_vendor_order(p_order); end if;
  insert into public.vendor_order_events (order_id, status, note, actor_id) values (p_order, p_status::text, nullif(trim(p_note), ''), auth.uid());
  perform public.notify(v_order.buyer_id, 'shop_order', 'Order ' || v_order.order_number || ' update',
    case p_status
      when 'confirmed' then 'The shop confirmed your order.'
      when 'out_for_delivery' then 'Your order is on its way.'
      when 'ready_for_pickup' then 'Your order is ready for pickup.'
      when 'completed' then 'Order completed. Thanks for shopping!'
      when 'declined' then 'The shop couldn''t take your order: ' || p_note
      else 'The shop cancelled your order: ' || p_note
    end, '/orders/shop/' || p_order, p_order);
end;
$$;

-- Buyer cancels before the vendor confirms, or marks a MoMo payment as sent.
create or replace function public.buyer_update_vendor_order(p_order uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.vendor_orders;
  v_owner uuid;
begin
  select * into v_order from public.vendor_orders where id = p_order and buyer_id = auth.uid() for update;
  if v_order.id is null then raise exception 'Order not found' using errcode = '42501'; end if;
  select owner_id into v_owner from public.shops where id = v_order.shop_id;

  if p_action = 'cancel' then
    if v_order.status <> 'requested' then
      raise exception 'The shop already confirmed this order. Message them to cancel.' using errcode = 'P0001';
    end if;
    update public.vendor_orders set status = 'cancelled' where id = p_order;
    perform public.restock_vendor_order(p_order);
    insert into public.vendor_order_events (order_id, status, note, actor_id) values (p_order, 'cancelled', 'Cancelled by buyer', auth.uid());
    perform public.notify(v_owner, 'shop_order', 'Order ' || v_order.order_number || ' cancelled', 'The buyer cancelled before you confirmed.', '/seller-dashboard/orders', p_order);
  elsif p_action = 'mark_paid' then
    if v_order.payment_method <> 'momo_to_vendor' or v_order.status not in ('requested', 'confirmed', 'out_for_delivery', 'ready_for_pickup') then
      raise exception 'Nothing to mark as paid' using errcode = 'P0001';
    end if;
    update public.vendor_orders set buyer_marked_paid = true where id = p_order;
    insert into public.vendor_order_events (order_id, status, note, actor_id) values (p_order, 'buyer_marked_paid', 'Buyer says they sent the MoMo payment', auth.uid());
    perform public.notify(v_owner, 'shop_order', 'Payment sent for ' || v_order.order_number, 'The buyer says they sent GH₵ ' || v_order.subtotal || ' by MoMo. Check your wallet before delivering.', '/seller-dashboard/orders', p_order);
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

create or replace function public.vendor_confirm_payment(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.vendor_orders o set vendor_confirmed_payment = true
    from public.shops s
   where o.id = p_order and s.id = o.shop_id and s.owner_id = auth.uid() and o.status not in ('declined', 'cancelled');
  if not found then raise exception 'Order not found' using errcode = '42501'; end if;
  insert into public.vendor_order_events (order_id, status, note, actor_id) values (p_order, 'payment_received', 'Vendor confirmed payment received', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Shop advertising: promotions can target a shop ("featured shop")
-- ---------------------------------------------------------------------------
alter type public.promotion_kind add value if not exists 'featured_shop';
alter table public.promotions alter column listing_id drop not null;
alter table public.promotions add column shop_id uuid references public.shops (id) on delete cascade;
alter table public.promotions add constraint promotions_target_check check ((listing_id is null) <> (shop_id is null));

create or replace function public.admin_set_shop_status(p_shop uuid, p_status public.shop_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop public.shops;
begin
  perform public.require_admin();
  perform public.trust();
  if p_status = 'suspended' and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = '22023'; end if;
  update public.shops set status = p_status, status_reason = case when p_status = 'active' then null else p_reason end
   where id = p_shop returning * into v_shop;
  if v_shop.id is null then raise exception 'Shop not found'; end if;
  if p_status <> 'active' then update public.listings set orderable = false where seller_id = v_shop.owner_id; end if;
  perform public.log_admin_action('shop.' || p_status::text, 'shop', p_shop::text, p_reason, jsonb_build_object('name', v_shop.name));
  perform public.notify(v_shop.owner_id, 'shop',
    case p_status when 'active' then 'Your shop is live' when 'suspended' then 'Your shop was suspended' else 'Your shop is under review' end,
    case p_status when 'active' then v_shop.name || ' is now visible to buyers.' else coalesce(p_reason, '') end,
    '/seller-dashboard/shop', p_shop);
end;
$$;

create or replace function public.admin_set_shop_flags(p_shop uuid, p_verified boolean default null, p_featured_days integer default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  perform public.trust();
  if p_verified and coalesce(trim(p_reason), '') = '' then raise exception 'Record what was verified' using errcode = '22023'; end if;
  update public.shops
     set is_verified = coalesce(p_verified, is_verified),
         featured_until = case when p_featured_days is null then featured_until when p_featured_days <= 0 then null else now() + make_interval(days => p_featured_days) end
   where id = p_shop;
  perform public.log_admin_action('shop.flags', 'shop', p_shop::text, p_reason, jsonb_build_object('verified', p_verified, 'featured_days', p_featured_days));
end;
$$;

-- Featured-shop promotion request (uses the existing plans of kind featured_shop).
create or replace function public.request_shop_promotion(p_plan uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_shop public.shops;
  v_plan public.promotion_plans;
  v_id uuid;
begin
  select * into v_shop from public.shops where owner_id = auth.uid() and status = 'active';
  if v_shop.id is null then raise exception 'Your shop must be live to advertise it' using errcode = '42501'; end if;
  select * into v_plan from public.promotion_plans where id = p_plan and is_active and kind = 'featured_shop';
  if v_plan.id is null then raise exception 'Plan not available' using errcode = 'P0002'; end if;
  if exists (select 1 from public.promotions where shop_id = v_shop.id and status in ('pending_payment', 'active') and coalesce(ends_at, 'infinity') > now()) then
    raise exception 'Your shop already has a pending or active promotion' using errcode = '23505';
  end if;
  insert into public.promotions (shop_id, seller_id, plan_id, kind, amount, currency, duration_days)
  values (v_shop.id, auth.uid(), v_plan.id, v_plan.kind, v_plan.price, v_plan.currency, v_plan.duration_days)
  returning id into v_id;
  return v_id;
end;
$$;

-- Activation of a featured-shop promotion also sets featured_until.
create or replace function public.promotions_sync_shop()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_prev text;
begin
  if new.shop_id is not null and new.status = 'active' and (old.status is distinct from 'active') then
    v_prev := public.trust();
    update public.shops set featured_until = greatest(coalesce(featured_until, now()), new.ends_at) where id = new.shop_id;
    perform public.untrust(v_prev);
  end if;
  return new;
end;
$$;
create trigger promotions_sync_shop after update of status on public.promotions
  for each row execute function public.promotions_sync_shop();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.shop_cart_items enable row level security;
alter table public.vendor_orders enable row level security;
alter table public.vendor_order_items enable row level security;
alter table public.vendor_order_events enable row level security;

create policy "shops public read" on public.shops for select using (public.shop_is_public(shops) or owner_id = auth.uid() or public.is_admin());
create policy "shops owner insert" on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy "shops owner update" on public.shops for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user()) with check (owner_id = auth.uid());

create policy "shop cart own read" on public.shop_cart_items for select to authenticated using (user_id = auth.uid());
create policy "shop cart own insert" on public.shop_cart_items for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.listings l where l.id = listing_id and l.orderable and l.status = 'published' and l.seller_id <> auth.uid()));
create policy "shop cart own update" on public.shop_cart_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shop cart own delete" on public.shop_cart_items for delete to authenticated using (user_id = auth.uid());

-- Buyer and the shop owner see an order; writes only through the functions above.
create policy "vendor orders parties read" on public.vendor_orders for select to authenticated
  using (buyer_id = auth.uid() or public.is_admin() or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "vendor order items read" on public.vendor_order_items for select to authenticated
  using (exists (select 1 from public.vendor_orders o where o.id = order_id));
create policy "vendor order events read" on public.vendor_order_events for select to authenticated
  using (exists (select 1 from public.vendor_orders o where o.id = order_id));

-- Promotions now include shop promotions owned by the seller (existing policy covers seller_id).

revoke execute on function public.restock_vendor_order(uuid) from public, anon, authenticated;
revoke execute on function public.place_shop_order(uuid, public.vendor_payment_method, text, text, smallint, text, text, text) from public, anon;
revoke execute on function public.vendor_update_order(uuid, public.vendor_order_status, text) from public, anon;
revoke execute on function public.buyer_update_vendor_order(uuid, text) from public, anon;
revoke execute on function public.vendor_confirm_payment(uuid) from public, anon;
revoke execute on function public.admin_set_shop_status(uuid, public.shop_status, text) from public, anon;
revoke execute on function public.admin_set_shop_flags(uuid, boolean, integer, text) from public, anon;
revoke execute on function public.request_shop_promotion(uuid) from public, anon;

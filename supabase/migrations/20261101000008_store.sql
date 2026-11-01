-- QuestHub Store: products sold by QuestHub itself, cart, orders, payments,
-- and airtime/data top-ups. Prices and totals are always computed in the
-- database from server-side data; orders become paid only through
-- confirm_order_payment(), which the server calls after verifying the
-- payment with the provider.

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default '',
  name text not null check (char_length(name) between 3 and 120),
  brand text check (char_length(brand) <= 60),
  description text not null default '' check (char_length(description) <= 8000),
  category_id uuid references public.categories (id) on delete set null,
  price numeric(12, 2) not null check (price > 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > price),
  stock integer not null default 0 check (stock >= 0),
  sku text unique,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  warranty text check (char_length(warranty) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);

create index store_products_active_idx on public.store_products (is_active, created_at desc);
create index store_products_category_idx on public.store_products (category_id) where is_active;
create index store_products_search_idx on public.store_products using gin (search_vector);

create or replace function public.store_products_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.slug := left(public.slugify(coalesce(new.brand || ' ', '') || new.name), 80) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger store_products_before_write before insert or update on public.store_products
  for each row execute function public.store_products_before_write();

create table public.store_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products (id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index store_product_images_idx on public.store_product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- Cart (signed-in users)
-- ---------------------------------------------------------------------------
create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.store_products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Top-up catalogue (admin-managed; provider codes come from the Hubtel dashboard)
-- ---------------------------------------------------------------------------
create type public.mobile_network as enum ('mtn', 'telecel', 'airteltigo');

create table public.topup_bundles (
  id uuid primary key default gen_random_uuid(),
  network public.mobile_network not null,
  name text not null check (char_length(name) between 2 and 60),
  data_mb integer check (data_mb > 0),
  validity text check (char_length(validity) <= 40),
  price numeric(10, 2) not null check (price > 0),
  provider_code text not null check (char_length(provider_code) between 1 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index topup_bundles_network_idx on public.topup_bundles (network, sort_order) where is_active;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create type public.order_kind as enum ('goods', 'topup');
create type public.order_status as enum
  ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'refund_due', 'refunded');
create type public.topup_status as enum ('waiting_payment', 'sending', 'delivered', 'failed');

create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('QH' || nextval('public.order_number_seq')),
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind public.order_kind not null,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total numeric(12, 2) not null check (total > 0),
  currency char(3) not null default 'GHS',
  -- goods delivery
  delivery_name text,
  delivery_phone text,
  delivery_region_id smallint references public.regions (id),
  delivery_city text,
  delivery_address text,
  delivery_notes text,
  -- top-ups
  topup_network public.mobile_network,
  topup_type text check (topup_type in ('airtime', 'data')),
  topup_recipient text,
  topup_bundle_id uuid references public.topup_bundles (id) on delete set null,
  topup_bundle_name text,
  topup_provider_code text,
  topup_status public.topup_status,
  topup_provider_reference text,
  topup_attempts integer not null default 0,
  topup_last_error text,
  staff_note text,
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'topup' or (topup_network is not null and topup_type is not null and topup_recipient ~ '^0[2-5][0-9]{8}$')),
  check (kind <> 'goods' or (delivery_name is not null and delivery_phone is not null and delivery_region_id is not null and delivery_address is not null))
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.store_products (id) on delete set null,
  product_name text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) generated always as (unit_price * quantity) stored
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- Payments now cover orders as well as promotions; 'test' provider for test mode.
alter table public.payments drop constraint payments_purpose_check;
alter table public.payments add constraint payments_purpose_check check (purpose in ('promotion', 'order'));
alter table public.payments drop constraint payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('paystack', 'hubtel', 'test'));
alter table public.payments add column order_id uuid references public.orders (id) on delete set null;
alter table public.payments add column checkout_id text;
create index payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('delivery_fee_default', '35', 'Delivery fee in GH₵ for regions without their own fee.'),
  ('delivery_fees', '{"1": 25, "2": 30}', 'Delivery fee per region id (1 = Greater Accra, 2 = Ashanti, …) as JSON.'),
  ('free_delivery_over', '1500', 'Orders at or above this subtotal (GH₵) get free delivery. 0 turns it off.'),
  ('airtime_min', '1', 'Smallest airtime top-up in GH₵.'),
  ('airtime_max', '500', 'Largest airtime top-up in GH₵.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Order functions
-- ---------------------------------------------------------------------------
create or replace function public.log_order_event(p_order uuid, p_status text, p_note text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_events (order_id, status, note, actor_id) values (p_order, p_status, p_note, auth.uid());
$$;

create or replace function public.delivery_fee_for(p_region smallint, p_subtotal numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce((public.setting('free_delivery_over'))::numeric, 0) > 0
         and p_subtotal >= (public.setting('free_delivery_over'))::numeric then 0
    else coalesce((public.setting('delivery_fees') ->> p_region::text)::numeric,
                  (public.setting('delivery_fee_default'))::numeric, 35)
  end;
$$;

-- Creates a goods order from the caller's cart, reserving stock.
create or replace function public.place_goods_order(
  p_name text, p_phone text, p_region smallint, p_city text, p_address text, p_notes text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_subtotal numeric := 0;
  v_fee numeric;
  v_order uuid;
  r record;
begin
  if v_user is null or not public.is_active_user() then
    raise exception 'Sign in with an active account to order' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or trim(coalesce(p_phone, '')) !~ '^(\+233|0)[235][0-9]{8}$'
     or p_region is null or char_length(trim(coalesce(p_address, ''))) < 5 then
    raise exception 'Enter your name, a Ghana phone number, region and delivery address' using errcode = '22023';
  end if;

  -- Lock products in a stable order to avoid deadlocks between checkouts
  for r in
    select c.product_id, c.quantity, p.name, p.price, p.stock, p.is_active
      from public.cart_items c join public.store_products p on p.id = c.product_id
     where c.user_id = v_user
     order by c.product_id
       for update of p
  loop
    if not r.is_active then
      raise exception '% is no longer available. Remove it from your cart.', r.name using errcode = 'P0001';
    end if;
    if r.stock < r.quantity then
      raise exception 'Only % of % left. Update your cart.', r.stock, r.name using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + r.price * r.quantity;
  end loop;

  if v_subtotal = 0 then
    raise exception 'Your cart is empty' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders where user_id = v_user and status = 'pending_payment' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have several unpaid orders. Pay or wait for them to expire first.' using errcode = 'P0001';
  end if;

  v_fee := public.delivery_fee_for(p_region, v_subtotal);
  insert into public.orders (user_id, kind, subtotal, delivery_fee, total, delivery_name, delivery_phone,
                             delivery_region_id, delivery_city, delivery_address, delivery_notes)
  values (v_user, 'goods', v_subtotal, v_fee, v_subtotal + v_fee, trim(p_name), regexp_replace(p_phone, '\s', '', 'g'),
          p_region, nullif(trim(p_city), ''), trim(p_address), nullif(left(trim(p_notes), 500), ''))
  returning id into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
  select v_order, p.id, coalesce(p.brand || ' ', '') || p.name, p.price, c.quantity
    from public.cart_items c join public.store_products p on p.id = c.product_id
   where c.user_id = v_user;

  update public.store_products p set stock = p.stock - c.quantity
    from public.cart_items c
   where c.user_id = v_user and c.product_id = p.id;

  delete from public.cart_items where user_id = v_user;
  perform public.log_order_event(v_order, 'pending_payment', 'Order placed');
  return v_order;
end;
$$;

-- Creates an airtime or data order. Prices for data come from the catalogue.
create or replace function public.place_topup_order(
  p_network public.mobile_network, p_type text, p_recipient text, p_amount numeric, p_bundle uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_amount numeric;
  v_bundle public.topup_bundles;
  v_order uuid;
  v_min numeric := coalesce((public.setting('airtime_min'))::numeric, 1);
  v_max numeric := coalesce((public.setting('airtime_max'))::numeric, 500);
begin
  if v_user is null or not public.is_active_user() then
    raise exception 'Sign in with an active account to buy airtime or data' using errcode = '42501';
  end if;
  if p_recipient !~ '^0[2-5][0-9]{8}$' then
    raise exception 'Enter a 10-digit Ghana number starting with 0' using errcode = '22023';
  end if;
  if (select count(*) from public.orders where user_id = v_user and kind = 'topup' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many top-ups in the last hour. Try again later.' using errcode = 'P0001';
  end if;

  if p_type = 'airtime' then
    v_amount := round(p_amount, 2);
    if v_amount is null or v_amount < v_min or v_amount > v_max then
      raise exception 'Airtime must be between GH₵ % and GH₵ %', v_min, v_max using errcode = '22023';
    end if;
  elsif p_type = 'data' then
    select * into v_bundle from public.topup_bundles where id = p_bundle and is_active and network = p_network;
    if v_bundle.id is null then
      raise exception 'Choose an available data bundle for this network' using errcode = '22023';
    end if;
    v_amount := v_bundle.price;
  else
    raise exception 'Choose airtime or data' using errcode = '22023';
  end if;

  insert into public.orders (user_id, kind, subtotal, total, topup_network, topup_type, topup_recipient,
                             topup_bundle_id, topup_bundle_name, topup_provider_code, topup_status)
  values (v_user, 'topup', v_amount, v_amount, p_network, p_type, p_recipient,
          v_bundle.id, v_bundle.name, v_bundle.provider_code, 'waiting_payment')
  returning id into v_order;
  perform public.log_order_event(v_order, 'pending_payment', 'Top-up requested');
  return v_order;
end;
$$;

-- Called by trusted server code (service role) after the provider confirms a
-- payment. Idempotent; rejects amount mismatches.
create or replace function public.confirm_order_payment(
  p_order uuid, p_amount numeric, p_payment_status public.payment_status
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if p_payment_status not in ('paid', 'test') then
    raise exception 'Invalid payment status';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.payment_status in ('paid', 'test') then
    return v_order; -- already confirmed (duplicate callback)
  end if;
  if round(p_amount, 2) <> v_order.total then
    perform public.log_order_event(p_order, 'payment_mismatch', 'Paid ' || p_amount || ', expected ' || v_order.total);
    raise exception 'Payment amount does not match order total';
  end if;

  update public.orders
     set payment_status = p_payment_status,
         status = case when status = 'cancelled' then 'refund_due'::public.order_status else 'paid'::public.order_status end,
         topup_status = case when kind = 'topup' then 'sending'::public.topup_status else topup_status end,
         paid_at = now()
   where id = p_order
  returning * into v_order;

  perform public.log_order_event(p_order, v_order.status::text,
    case when p_payment_status = 'test' then 'Test payment (no money received)' else 'Payment confirmed by provider' end);
  perform public.notify(v_order.user_id, 'order',
    case when v_order.status = 'refund_due' then 'Payment received for a cancelled order' else 'Payment received' end,
    'Order ' || v_order.order_number || ': ' ||
      case when v_order.kind = 'topup' then 'we''re sending your ' || v_order.topup_type || ' now.' else 'we''re preparing it for delivery.' end,
    '/orders/' || v_order.id, v_order.id);
  return v_order;
end;
$$;

create or replace function public.record_payment_failure(p_order uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set payment_status = 'failed'
   where id = p_order and payment_status in ('unpaid', 'pending');
  perform public.log_order_event(p_order, 'payment_failed', left(p_reason, 300));
end;
$$;

-- Top-up fulfilment result (service role, after calling the provider).
create or replace function public.record_topup_result(
  p_order uuid, p_delivered boolean, p_provider_reference text default null, p_error text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders
     set topup_status = case when p_delivered then 'delivered'::public.topup_status else 'failed'::public.topup_status end,
         status = case when p_delivered then 'delivered'::public.order_status else 'refund_due'::public.order_status end,
         topup_provider_reference = coalesce(p_provider_reference, topup_provider_reference),
         topup_attempts = topup_attempts + 1,
         topup_last_error = case when p_delivered then null else left(p_error, 300) end
   where id = p_order and kind = 'topup' and topup_status in ('sending', 'failed')
  returning * into v_order;
  if v_order.id is null then return; end if;
  perform public.log_order_event(p_order, v_order.status::text, coalesce(p_error, 'Delivered by provider'));
  perform public.notify(v_order.user_id, 'order',
    case when p_delivered then 'Top-up delivered' else 'Top-up didn''t go through' end,
    case when p_delivered then initcap(v_order.topup_type) || ' sent to ' || v_order.topup_recipient || '.'
         else 'We couldn''t send your ' || v_order.topup_type || '. Our team will retry or refund you.' end,
    '/orders/' || v_order.id, v_order.id);
end;
$$;

-- Unpaid orders expire and release reserved stock (run from a scheduler).
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.orders set status = 'cancelled', topup_status = case when kind = 'topup' then 'failed'::public.topup_status end
     where status = 'pending_payment' and payment_status in ('unpaid', 'pending', 'failed') and expires_at < now()
    returning id
  ), restock as (
    update public.store_products p set stock = p.stock + i.quantity
      from public.order_items i join expired e on e.id = i.order_id
     where p.id = i.product_id
    returning 1
  )
  insert into public.order_events (order_id, status, note)
  select id, 'cancelled', 'Not paid in time' from expired;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Customer cancels an unpaid order.
create or replace function public.cancel_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders set status = 'cancelled', topup_status = case when kind = 'topup' then 'failed'::public.topup_status end
   where id = p_order and user_id = auth.uid() and status = 'pending_payment' and payment_status in ('unpaid', 'failed')
  returning * into v_order;
  if v_order.id is null then
    raise exception 'Only unpaid orders can be cancelled here. Contact support for paid orders.' using errcode = '42501';
  end if;
  update public.store_products p set stock = p.stock + i.quantity
    from public.order_items i where i.order_id = p_order and p.id = i.product_id;
  perform public.log_order_event(p_order, 'cancelled', 'Cancelled by customer');
end;
$$;

-- Staff moves a goods order through fulfilment.
create or replace function public.admin_update_order(p_order uuid, p_status public.order_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_allowed boolean;
begin
  perform public.require_admin();
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

-- Staff asks the server to retry a failed top-up: puts it back in "sending".
create or replace function public.admin_retry_topup(p_order uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.orders set topup_status = 'sending', status = 'paid'
   where id = p_order and kind = 'topup' and topup_status = 'failed' and payment_status in ('paid', 'test') and status = 'refund_due';
  if not found then raise exception 'Only failed, paid top-ups can be retried'; end if;
  perform public.log_order_event(p_order, 'paid', 'Retry requested: ' || coalesce(p_note, ''));
  perform public.log_admin_action('order.topup_retry', 'order', p_order::text, p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.store_products enable row level security;
alter table public.store_product_images enable row level security;
alter table public.cart_items enable row level security;
alter table public.topup_bundles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

create policy "products public read" on public.store_products for select using (is_active or public.is_admin());
create policy "products admin insert" on public.store_products for insert to authenticated with check (public.is_admin());
create policy "products admin update" on public.store_products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products admin delete" on public.store_products for delete to authenticated using (public.is_admin());

create policy "product images read" on public.store_product_images for select
  using (exists (select 1 from public.store_products p where p.id = product_id));
create policy "product images admin insert" on public.store_product_images for insert to authenticated with check (public.is_admin());
create policy "product images admin update" on public.store_product_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "product images admin delete" on public.store_product_images for delete to authenticated using (public.is_admin());

create policy "cart own read" on public.cart_items for select to authenticated using (user_id = auth.uid());
create policy "cart own insert" on public.cart_items for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.store_products p where p.id = product_id and p.is_active));
create policy "cart own update" on public.cart_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart own delete" on public.cart_items for delete to authenticated using (user_id = auth.uid());

create policy "bundles public read" on public.topup_bundles for select using (is_active or public.is_admin());
create policy "bundles admin insert" on public.topup_bundles for insert to authenticated with check (public.is_admin());
create policy "bundles admin update" on public.topup_bundles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders: read own; no client writes (only through the functions above).
create policy "orders own read" on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "order items read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "order events read" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create trigger store_products_audit after insert or update or delete on public.store_products
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();
create trigger topup_bundles_audit after insert or update or delete on public.topup_bundles
  for each row when (public.is_client_call()) execute function public.audit_admin_table_change();

-- Product images bucket: public read, admin-only writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "product images admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- Function privileges
revoke execute on function public.confirm_order_payment(uuid, numeric, public.payment_status) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_topup_result(uuid, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
revoke execute on function public.log_order_event(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.place_goods_order(text, text, smallint, text, text, text) from public, anon;
revoke execute on function public.place_topup_order(public.mobile_network, text, text, numeric, uuid) from public, anon;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
revoke execute on function public.admin_update_order(uuid, public.order_status, text) from public, anon;
revoke execute on function public.admin_retry_topup(uuid, text) from public, anon;
grant execute on function public.confirm_order_payment(uuid, numeric, public.payment_status) to service_role;
grant execute on function public.record_payment_failure(uuid, text) to service_role;
grant execute on function public.record_topup_result(uuid, boolean, text, text) to service_role;
grant execute on function public.expire_unpaid_orders() to service_role;

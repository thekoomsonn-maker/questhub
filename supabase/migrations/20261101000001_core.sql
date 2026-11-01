-- QuestHub core schema: types, helpers, profiles, settings, regions, categories
-- Conventions:
--   * Every exposed table has RLS enabled.
--   * Privileged changes go through SECURITY DEFINER functions (run as the
--     function owner). Direct PostgREST writes run as role "authenticated";
--     guard triggers use current_user to tell the two apart.
--   * SECURITY DEFINER functions pin search_path = '' and use qualified names.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('buyer', 'seller', 'admin');
create type public.account_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current statement comes from an API client (PostgREST sets
-- the session role to anon/authenticated) and is not running inside one of
-- our trusted functions. SECURITY DEFINER changes current_user but not the
-- session "role" setting, so trusted functions mark themselves explicitly
-- with trust()/untrust(), which clients cannot execute.
create or replace function public.is_client_call()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_setting('role', true) in ('authenticated', 'anon')
     and coalesce(current_setting('questhub.trusted', true), '') <> 'on';
$$;

create or replace function public.trust()
returns text
language sql
set search_path = ''
as $$
  select coalesce(current_setting('questhub.trusted', true), '')
    || left(set_config('questhub.trusted', 'on', true), 0);
$$;

create or replace function public.untrust(p_previous text default '')
returns void
language sql
set search_path = ''
as $$
  select set_config('questhub.trusted', coalesce(p_previous, ''), true);
$$;

revoke execute on function public.trust() from public, anon, authenticated;
revoke execute on function public.untrust(text) from public, anon, authenticated;

create or replace function public.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Profiles (public-facing fields only; contact details live separately)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  username text unique check (username ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  avatar_path text,
  bio text check (char_length(bio) <= 500),
  region_id smallint,
  city text check (char_length(city) <= 80),
  role public.user_role not null default 'buyer',
  status public.account_status not null default 'active',
  is_verified boolean not null default false,
  verified_at timestamptz,
  suspended_reason text,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private contact details: visible to the owner and admins, and to signed-in
-- users only when the owner opts in (show_phone).
create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{9,16}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{9,16}$'),
  show_phone boolean not null default false,
  email_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger profile_contacts_updated_at before update on public.profile_contacts
  for each row execute function public.set_updated_at();

-- Role / status helpers (SECURITY DEFINER so they can read profiles under RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.can_sell()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('seller', 'admin')
  );
$$;

-- Clients may never change role, status or verification directly.
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
       or new.id is distinct from old.id then
      raise exception 'Not allowed to change protected profile fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Create a profile for every new auth user. Always starts as a buyer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1),
    'QuestHub user'
  ), 60);
  if char_length(v_name) < 2 then
    v_name := 'QuestHub user';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name);

  insert into public.profile_contacts (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_questhub
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Self-service upgrade from buyer to seller.
create or replace function public.become_seller()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  v_prev := public.trust();
  update public.profiles
     set role = 'seller'
   where id = auth.uid() and role = 'buyer' and status = 'active';
  perform public.untrust(v_prev);
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform settings (non-secret configuration, readable by everyone)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

create or replace function public.setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.platform_settings where key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Regions (Ghana's 16 administrative regions; seeded)
-- ---------------------------------------------------------------------------
create table public.regions (
  id smallint primary key,
  name text not null unique,
  slug text not null unique,
  capital text not null
);

alter table public.profiles
  add constraint profiles_region_fk foreign key (region_id) references public.regions (id);

-- ---------------------------------------------------------------------------
-- Categories (nestable) and category attribute definitions
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_not_self_parent check (parent_id is distinct from id)
);

create index categories_parent_idx on public.categories (parent_id, sort_order);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- Prevent cycles when nesting categories.
create or replace function public.guard_category_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.categories where id = new.parent_id
      union all
      select c.id, c.parent_id from public.categories c join up on c.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'Category cannot be nested inside itself';
  end if;
  return new;
end;
$$;

create trigger categories_no_cycle before insert or update of parent_id on public.categories
  for each row execute function public.guard_category_cycle();

-- Category plus all descendants
create or replace function public.category_descendants(p_category uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select id from public.categories where id = p_category
    union all
    select c.id from public.categories c join tree t on c.parent_id = t.id
  )
  select id from tree;
$$;

-- Category plus all ancestors (attributes are inherited down the tree)
create or replace function public.category_ancestors(p_category uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with recursive up as (
    select id, parent_id from public.categories where id = p_category
    union all
    select c.id, c.parent_id from public.categories c join up on c.id = up.parent_id
  )
  select id from up;
$$;

create type public.attribute_type as enum ('text', 'number', 'select', 'boolean');

create table public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null,
  type public.attribute_type not null default 'text',
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  unit text,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, key)
);

create index category_attributes_category_idx on public.category_attributes (category_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.regions enable row level security;
alter table public.categories enable row level security;
alter table public.category_attributes enable row level security;

-- Profiles: public fields readable for active accounts; owners and admins see all
create policy "profiles readable" on public.profiles for select
  using (status = 'active' or id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Contacts: owner/admin always; other signed-in users only if opted in
create policy "contacts owner read" on public.profile_contacts for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or show_phone);
create policy "contacts owner update" on public.profile_contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "settings readable" on public.platform_settings for select using (true);
create policy "settings admin write" on public.platform_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "regions readable" on public.regions for select using (true);

create policy "categories readable" on public.categories for select
  using (is_active or public.is_admin());
create policy "categories admin insert" on public.categories for insert to authenticated
  with check (public.is_admin());
create policy "categories admin update" on public.categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "categories admin delete" on public.categories for delete to authenticated
  using (public.is_admin());

create policy "attributes readable" on public.category_attributes for select using (true);
create policy "attributes admin insert" on public.category_attributes for insert to authenticated
  with check (public.is_admin());
create policy "attributes admin update" on public.category_attributes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "attributes admin delete" on public.category_attributes for delete to authenticated
  using (public.is_admin());

-- Function privileges
revoke execute on function public.become_seller() from public, anon;
grant execute on function public.become_seller() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Separate migration: a new enum value can only be used after it is committed.
insert into public.promotion_plans (name, kind, duration_days, price, description, sort_order)
select 'Featured shop — 14 days', 'featured_shop', 14, 120.00, 'Your shop appears in the Featured shops section on the home page and at the top of the shop directory.', 10
where not exists (select 1 from public.promotion_plans where kind = 'featured_shop');

-- Crypto payments (NOWPayments) and dress accessories.

-- ---------------------------------------------------------------------------
-- Payments: crypto provider and the converted amount actually invoiced
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('paystack', 'hubtel', 'nowpayments', 'test'));

alter table public.payments
  add column method text not null default 'mobile_money_card' check (method in ('mobile_money_card', 'crypto')),
  add column provider_amount numeric(14, 2),      -- amount in provider_currency (e.g. USD for crypto invoices)
  add column provider_currency char(3),
  add column fx_rate numeric(12, 4),              -- GHS per 1 unit of provider_currency at invoice time
  add column provider_payment_id text,
  add column pay_currency text;                   -- coin the customer paid with, e.g. usdttrc20

insert into public.platform_settings (key, value, description) values
  ('crypto_usd_rate', '0', 'GH₵ per US$1 used to price crypto invoices. Set to 0 to hide crypto at checkout. Update it regularly.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Dress accessories (marketplace subcategories under Fashion)
-- ---------------------------------------------------------------------------
insert into public.categories (parent_id, name, slug, sort_order)
select f.id, v.name, v.slug, v.ord
  from public.categories f,
       (values
         ('Belts, Ties & Cufflinks', 'belts-ties', 7),
         ('Sunglasses & Eyewear', 'eyewear', 8),
         ('Hats, Scarves & Headwraps', 'hats-scarves-headwraps', 9),
         ('Hair Accessories', 'hair-accessories', 10),
         ('Beads & Traditional Accessories', 'beads-traditional', 11)
       ) as v(name, slug, ord)
 where f.slug = 'fashion'
on conflict (slug) do nothing;

with defs(slug, key, label, type, options, req, filt, ord) as (values
  ('belts-ties', 'item', 'Item', 'select', '["Belt","Tie","Bow tie","Cufflinks","Tie clip","Pocket square","Suspenders"]', true, true, 1),
  ('belts-ties', 'material', 'Material', 'select', '["Leather","Faux leather","Silk","Cotton","Kente","Metal","Other"]', false, true, 2),
  ('belts-ties', 'colour', 'Colour', 'text', '[]', false, true, 3),
  ('eyewear', 'item', 'Item', 'select', '["Sunglasses","Reading glasses","Blue-light glasses","Frames only"]', true, true, 1),
  ('eyewear', 'gender', 'For', 'select', '["Women","Men","Unisex"]', false, true, 2),
  ('eyewear', 'brand', 'Brand', 'text', '[]', false, true, 3),
  ('hats-scarves-headwraps', 'item', 'Item', 'select', '["Hat","Cap","Scarf","Headwrap / gele","Durag","Fascinator"]', true, true, 1),
  ('hats-scarves-headwraps', 'material', 'Material', 'select', '["Cotton","Ankara","Kente","Silk","Wool","Straw","Other"]', false, true, 2),
  ('hats-scarves-headwraps', 'colour', 'Colour', 'text', '[]', false, true, 3),
  ('hair-accessories', 'item', 'Item', 'select', '["Hair clips","Headband","Scrunchies","Hair pins","Bonnet","Other"]', true, true, 1),
  ('hair-accessories', 'colour', 'Colour', 'text', '[]', false, false, 2),
  ('beads-traditional', 'item', 'Item', 'select', '["Waist beads","Necklace","Bracelet","Anklet","Earrings","Krobo beads set","Other"]', true, true, 1),
  ('beads-traditional', 'material', 'Material', 'select', '["Glass beads","Recycled glass","Brass","Gold-plated","Bone","Wood","Other"]', false, true, 2),
  ('beads-traditional', 'colour', 'Colour', 'text', '[]', false, true, 3),
  ('bags', 'gender', 'For', 'select', '["Women","Men","Unisex"]', false, true, 1),
  ('bags', 'material', 'Material', 'select', '["Leather","Faux leather","Fabric","Kente","Raffia","Other"]', false, true, 2),
  ('jewellery-watches', 'item', 'Item', 'select', '["Watch","Necklace","Bracelet","Ring","Earrings","Set"]', false, true, 1),
  ('jewellery-watches', 'material', 'Material', 'select', '["Gold","Silver","Gold-plated","Stainless steel","Beads","Other"]', false, true, 2)
)
insert into public.category_attributes (category_id, key, label, type, options, is_required, is_filterable, sort_order)
select c.id, d.key, d.label, d.type::public.attribute_type, d.options::jsonb, d.req, d.filt, d.ord
  from defs d join public.categories c on c.slug = d.slug
on conflict (category_id, key) do nothing;

-- Reference data needed in every environment (admins can edit afterwards).

insert into public.platform_settings (key, value, description) values
  ('require_listing_review', 'true', 'When true, every submitted listing waits for a moderator. When false, listings without prohibited terms publish immediately.'),
  ('prohibited_terms', '["firearm","gun","ammunition","cocaine","heroin","tramadol","counterfeit","fake id","ivory","pangolin","stolen"]', 'Listings containing these words are always held for review.'),
  ('max_active_listings_per_user', '50', 'Maximum drafts + live listings per seller.'),
  ('max_new_listings_per_day', '10', 'Maximum new listings per seller in 24 hours.'),
  ('max_images_per_listing', '10', 'Maximum photos per listing.'),
  ('listing_expiry_days', '60', 'Days a published listing stays live before it must be renewed.'),
  ('max_messages_per_minute', '20', 'Message rate limit per user.'),
  ('max_new_conversations_per_hour', '15', 'New conversations a buyer can start per hour.'),
  ('promotions_test_mode', 'true', 'When true, admins can activate promotions without payment for testing. They are recorded as test, never as paid.'),
  ('checkout_enabled', 'false', 'Integrated payments for promotions. Requires provider keys on the server.')
on conflict (key) do nothing;

insert into public.regions (id, name, slug, capital) values
  (1, 'Greater Accra', 'greater-accra', 'Accra'),
  (2, 'Ashanti', 'ashanti', 'Kumasi'),
  (3, 'Western', 'western', 'Sekondi-Takoradi'),
  (4, 'Western North', 'western-north', 'Sefwi Wiawso'),
  (5, 'Central', 'central', 'Cape Coast'),
  (6, 'Eastern', 'eastern', 'Koforidua'),
  (7, 'Volta', 'volta', 'Ho'),
  (8, 'Oti', 'oti', 'Dambai'),
  (9, 'Northern', 'northern', 'Tamale'),
  (10, 'Savannah', 'savannah', 'Damongo'),
  (11, 'North East', 'north-east', 'Nalerigu'),
  (12, 'Upper East', 'upper-east', 'Bolgatanga'),
  (13, 'Upper West', 'upper-west', 'Wa'),
  (14, 'Bono', 'bono', 'Sunyani'),
  (15, 'Bono East', 'bono-east', 'Techiman'),
  (16, 'Ahafo', 'ahafo', 'Goaso')
on conflict (id) do nothing;

-- Categories ---------------------------------------------------------------
do $$
declare
  tree jsonb := '[
    {"name":"Phones & Electronics","slug":"phones-electronics","icon":"smartphone","children":[
      ["Mobile Phones","mobile-phones"],["Tablets","tablets"],["Laptops & Computers","laptops-computers"],
      ["TV & Audio","tv-audio"],["Cameras","cameras"],["Accessories","electronics-accessories"]]},
    {"name":"Vehicles & Spare Parts","slug":"vehicles","icon":"car","children":[
      ["Cars","cars"],["Motorcycles & Scooters","motorcycles"],["Trucks & Buses","trucks-buses"],
      ["Spare Parts","spare-parts"]]},
    {"name":"Property","slug":"property","icon":"building","children":[
      ["Houses & Apartments for Rent","property-for-rent"],["Houses & Apartments for Sale","property-for-sale"],
      ["Land & Plots","land-plots"],["Commercial Property","commercial-property"],["Short Stay","short-stay"]]},
    {"name":"Fashion","slug":"fashion","icon":"shirt","children":[
      ["Women''s Clothing","womens-clothing"],["Men''s Clothing","mens-clothing"],["Shoes","shoes"],
      ["Bags","bags"],["Jewellery & Watches","jewellery-watches"],["Kente & Traditional Wear","traditional-wear"]]},
    {"name":"Home & Furniture","slug":"home-furniture","icon":"sofa","children":[
      ["Furniture","furniture"],["Home Appliances","home-appliances"],["Kitchenware","kitchenware"],
      ["Home Decor","home-decor"]]},
    {"name":"Health & Beauty","slug":"health-beauty","icon":"sparkles","children":[
      ["Skin Care","skin-care"],["Hair & Wigs","hair-wigs"],["Fragrances","fragrances"],
      ["Fitness Equipment","fitness-equipment"]]},
    {"name":"Jobs & Services","slug":"jobs-services","icon":"briefcase","children":[
      ["Job Vacancies","jobs"],["Repair Services","repair-services"],["Cleaning Services","cleaning-services"],
      ["Events & Catering","events-catering"],["Tutoring & Lessons","tutoring"]]},
    {"name":"Sports & Hobbies","slug":"sports-hobbies","icon":"dumbbell","children":[
      ["Sports Equipment","sports-equipment"],["Bicycles","bicycles"],["Musical Instruments","musical-instruments"],
      ["Books & Games","books-games"]]},
    {"name":"Business & Industrial","slug":"business-industrial","icon":"factory","children":[
      ["Machinery","machinery"],["Generators & Solar","generators-solar"],["Office Equipment","office-equipment"],
      ["Building Materials","building-materials"]]},
    {"name":"Agriculture","slug":"agriculture","icon":"sprout","children":[
      ["Livestock & Poultry","livestock-poultry"],["Farm Machinery","farm-machinery"],
      ["Seeds & Fertiliser","seeds-fertiliser"],["Fresh Produce","fresh-produce"]]}
  ]';
  parent jsonb;
  child jsonb;
  parent_id uuid;
  i integer := 0;
  j integer;
begin
  for parent in select * from jsonb_array_elements(tree) loop
    i := i + 1;
    insert into public.categories (name, slug, icon, sort_order)
    values (parent ->> 'name', parent ->> 'slug', parent ->> 'icon', i)
    on conflict (slug) do update set name = excluded.name
    returning id into parent_id;
    j := 0;
    for child in select * from jsonb_array_elements(parent -> 'children') loop
      j := j + 1;
      insert into public.categories (parent_id, name, slug, sort_order)
      values (parent_id, child ->> 0, child ->> 1, j)
      on conflict (slug) do nothing;
    end loop;
  end loop;
end $$;

-- Category attributes ------------------------------------------------------
-- (slug, key, label, type, options, unit, required, filterable, sort)
with defs(slug, key, label, type, options, unit, req, filt, ord) as (values
  ('mobile-phones', 'brand', 'Brand', 'select', '["Apple","Samsung","Tecno","Infinix","itel","Xiaomi","Google","Huawei","Nokia","Oppo","Other"]', null, true, true, 1),
  ('mobile-phones', 'model', 'Model', 'text', '[]', null, true, false, 2),
  ('mobile-phones', 'storage', 'Storage', 'select', '["16 GB","32 GB","64 GB","128 GB","256 GB","512 GB","1 TB"]', null, true, true, 3),
  ('mobile-phones', 'ram', 'RAM', 'select', '["2 GB","3 GB","4 GB","6 GB","8 GB","12 GB","16 GB"]', null, false, true, 4),
  ('mobile-phones', 'colour', 'Colour', 'text', '[]', null, false, false, 5),
  ('tablets', 'brand', 'Brand', 'select', '["Apple","Samsung","Lenovo","Huawei","Amazon","Other"]', null, true, true, 1),
  ('tablets', 'storage', 'Storage', 'select', '["16 GB","32 GB","64 GB","128 GB","256 GB","512 GB"]', null, false, true, 2),
  ('laptops-computers', 'brand', 'Brand', 'select', '["Apple","HP","Dell","Lenovo","Asus","Acer","Microsoft","Other"]', null, true, true, 1),
  ('laptops-computers', 'processor', 'Processor', 'text', '[]', null, false, false, 2),
  ('laptops-computers', 'ram', 'RAM', 'select', '["4 GB","8 GB","16 GB","32 GB","64 GB"]', null, false, true, 3),
  ('laptops-computers', 'storage', 'Storage', 'select', '["128 GB","256 GB","512 GB","1 TB","2 TB"]', null, false, true, 4),
  ('tv-audio', 'brand', 'Brand', 'text', '[]', null, false, true, 1),
  ('tv-audio', 'screen_size', 'Screen size', 'number', '[]', 'inches', false, true, 2),
  ('cars', 'make', 'Make', 'select', '["Toyota","Honda","Hyundai","Kia","Nissan","Mercedes-Benz","BMW","Ford","Volkswagen","Mitsubishi","Mazda","Lexus","Other"]', null, true, true, 1),
  ('cars', 'model', 'Model', 'text', '[]', null, true, false, 2),
  ('cars', 'year', 'Year', 'number', '[]', null, true, true, 3),
  ('cars', 'mileage', 'Mileage', 'number', '[]', 'km', false, true, 4),
  ('cars', 'transmission', 'Transmission', 'select', '["Automatic","Manual"]', null, true, true, 5),
  ('cars', 'fuel_type', 'Fuel type', 'select', '["Petrol","Diesel","Hybrid","Electric","Gas"]', null, true, true, 6),
  ('cars', 'registered', 'Registered in Ghana', 'boolean', '[]', null, false, true, 7),
  ('motorcycles', 'make', 'Make', 'text', '[]', null, true, true, 1),
  ('motorcycles', 'year', 'Year', 'number', '[]', null, false, true, 2),
  ('motorcycles', 'engine_cc', 'Engine size', 'number', '[]', 'cc', false, true, 3),
  ('spare-parts', 'vehicle_make', 'For vehicle make', 'text', '[]', null, false, true, 1),
  ('spare-parts', 'part_type', 'Part type', 'text', '[]', null, false, false, 2),
  ('property-for-rent', 'property_type', 'Property type', 'select', '["Apartment","Self-contained","Chamber & hall","Detached house","Semi-detached","Townhouse","Room"]', null, true, true, 1),
  ('property-for-rent', 'bedrooms', 'Bedrooms', 'number', '[]', null, true, true, 2),
  ('property-for-rent', 'bathrooms', 'Bathrooms', 'number', '[]', null, false, true, 3),
  ('property-for-rent', 'furnished', 'Furnished', 'boolean', '[]', null, false, true, 4),
  ('property-for-rent', 'rent_period', 'Rent period', 'select', '["Per month","Per year"]', null, true, true, 5),
  ('property-for-sale', 'property_type', 'Property type', 'select', '["Apartment","Detached house","Semi-detached","Townhouse","Uncompleted building"]', null, true, true, 1),
  ('property-for-sale', 'bedrooms', 'Bedrooms', 'number', '[]', null, true, true, 2),
  ('property-for-sale', 'bathrooms', 'Bathrooms', 'number', '[]', null, false, true, 3),
  ('property-for-sale', 'title_document', 'Title document', 'select', '["Land title certificate","Indenture","Lease","None yet"]', null, false, true, 4),
  ('land-plots', 'plot_size', 'Plot size', 'number', '[]', 'plots', true, true, 1),
  ('land-plots', 'title_document', 'Title document', 'select', '["Land title certificate","Indenture","Lease","None yet"]', null, false, true, 2),
  ('womens-clothing', 'size', 'Size', 'select', '["XS","S","M","L","XL","XXL","3XL"]', null, false, true, 1),
  ('womens-clothing', 'brand', 'Brand', 'text', '[]', null, false, true, 2),
  ('womens-clothing', 'colour', 'Colour', 'text', '[]', null, false, true, 3),
  ('mens-clothing', 'size', 'Size', 'select', '["XS","S","M","L","XL","XXL","3XL"]', null, false, true, 1),
  ('mens-clothing', 'brand', 'Brand', 'text', '[]', null, false, true, 2),
  ('mens-clothing', 'colour', 'Colour', 'text', '[]', null, false, true, 3),
  ('shoes', 'size', 'EU size', 'number', '[]', null, true, true, 1),
  ('shoes', 'brand', 'Brand', 'text', '[]', null, false, true, 2),
  ('furniture', 'material', 'Material', 'select', '["Wood","Metal","Leather","Fabric","Glass","Plastic","Mixed"]', null, false, true, 1),
  ('furniture', 'dimensions', 'Dimensions', 'text', '[]', 'W × D × H cm', false, false, 2),
  ('home-appliances', 'brand', 'Brand', 'text', '[]', null, false, true, 1),
  ('jobs', 'job_type', 'Job type', 'select', '["Full-time","Part-time","Contract","Internship"]', null, true, true, 1),
  ('jobs', 'company', 'Company', 'text', '[]', null, true, false, 2),
  ('generators-solar', 'capacity', 'Capacity', 'number', '[]', 'kVA', false, true, 1),
  ('livestock-poultry', 'animal', 'Animal', 'select', '["Goats","Sheep","Cattle","Poultry","Pigs","Rabbits","Fish","Other"]', null, true, true, 1),
  ('livestock-poultry', 'breed', 'Breed', 'text', '[]', null, false, false, 2)
)
insert into public.category_attributes
  (category_id, key, label, type, options, unit, is_required, is_filterable, sort_order)
select c.id, d.key, d.label, d.type::public.attribute_type, d.options::jsonb, d.unit, d.req, d.filt, d.ord
  from defs d join public.categories c on c.slug = d.slug
on conflict (category_id, key) do nothing;

-- Promotion plans -----------------------------------------------------------
insert into public.promotion_plans (name, kind, duration_days, price, description, sort_order)
select * from (values
  ('Boost — 7 days', 'boost'::public.promotion_kind, 7, 25.00::numeric, 'Appear above regular results in search and category pages.', 1),
  ('Boost — 30 days', 'boost'::public.promotion_kind, 30, 80.00::numeric, 'A month of priority placement in search.', 2),
  ('Featured — 7 days', 'featured'::public.promotion_kind, 7, 60.00::numeric, 'Shown in the Featured section on the home page.', 3)
) v(name, kind, duration_days, price, description, sort_order)
where not exists (select 1 from public.promotion_plans);

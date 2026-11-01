/**
 * Demo data: accounts, listings with photos and a couple of test-mode promotions.
 * Run against a LOCAL or staging project only:  npm run seed
 * Photos in supabase/seed-images are AI-generated demo images.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see README).");
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.ALLOW_REMOTE_SEED !== "yes") {
  throw new Error(`Refusing to seed ${url}. Set ALLOW_REMOTE_SEED=yes to seed a non-local project.`);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = process.env.SEED_PASSWORD ?? "Questhub-demo-2026";

const users = [
  { email: "admin@questhub.local", name: "QuestHub Admin", role: "admin", city: "Osu", region: 1 },
  { email: "ama@questhub.local", name: "Ama's Gadget Hub", role: "seller", city: "Circle", region: 1, verified: true, phone: "0241234567", bio: "Phones, laptops and accessories. Shop at Kwame Nkrumah Circle, open Mon–Sat 9am–7pm. Delivery within Accra." },
  { email: "kofi@questhub.local", name: "Kofi Mensah", role: "seller", city: "Adum", region: 2, bio: "Selling household items before relocating." },
  { email: "esi@questhub.local", name: "Esi Owusu", role: "buyer", city: "Cape Coast", region: 5 },
] as const;

type Seed = {
  seller: string; category: string; image: string; title: string; description: string; price: number | null;
  negotiable?: boolean; condition: "new" | "used" | "refurbished" | "not_applicable"; region: number; city: string;
  attrs?: Record<string, string | number | boolean>; promote?: "featured" | "boost";
};

const listings: Seed[] = [
  { seller: "ama@questhub.local", category: "mobile-phones", image: "phone", title: "Samsung Galaxy A54, 128 GB, black", description: "Clean UK-used A54 in very good condition. Battery health is strong and the screen has no scratches. Comes with original charger. You can test it at the shop before buying.", price: 2450, negotiable: true, condition: "used", region: 1, city: "Circle", attrs: { brand: "Samsung", model: "Galaxy A54", storage: "128 GB", ram: "8 GB" }, promote: "featured" },
  { seller: "ama@questhub.local", category: "laptops-computers", image: "laptop", title: "13-inch laptop, 16 GB RAM, 512 GB SSD", description: "Slim aluminium laptop, perfect for students and remote work. Keyboard and trackpad work perfectly; battery lasts around 8 hours. Charger included. Six months shop warranty.", price: 6800, condition: "refurbished", region: 1, city: "Circle", attrs: { brand: "Apple", ram: "16 GB", storage: "512 GB" }, promote: "boost" },
  { seller: "kofi@questhub.local", category: "cars", image: "car", title: "Toyota Corolla 2014, automatic, silver", description: "Well maintained Corolla, single owner in Ghana since 2018. Full service history, new tyres, AC blowing cold. Registered and roadworthy. Viewing in Adum, Kumasi.", price: 98000, negotiable: true, condition: "used", region: 2, city: "Adum", attrs: { make: "Toyota", model: "Corolla", year: 2014, mileage: 128000, transmission: "Automatic", fuel_type: "Petrol", registered: true }, promote: "featured" },
  { seller: "kofi@questhub.local", category: "property-for-rent", image: "apartment", title: "2-bedroom apartment with balcony, East Legon", description: "Bright two-bedroom apartment on the second floor with balcony, ceiling fans, tiled floors and a fitted kitchen. Reliable water supply and backup power. One year advance.", price: 4500, condition: "not_applicable", region: 1, city: "East Legon", attrs: { property_type: "Apartment", bedrooms: 2, bathrooms: 2, furnished: false, rent_period: "Per month" } },
  { seller: "kofi@questhub.local", category: "furniture", image: "dining-table", title: "Solid wood dining table with 6 chairs", description: "Sturdy dark wood dining set, six chairs included. Minor wear on one chair leg, otherwise excellent. Selling because we are moving. Buyer arranges transport from Adum.", price: 3200, negotiable: true, condition: "used", region: 2, city: "Adum", attrs: { material: "Wood", dimensions: "160 × 90 × 76" } },
  { seller: "ama@questhub.local", category: "traditional-wear", image: "kente", title: "Handwoven kente cloth, gold and green, full piece", description: "Authentic handwoven kente from Bonwire weavers. Gold base with green, red and black pattern. Full piece suitable for a man's cloth or for sewing. Never worn.", price: 1800, condition: "new", region: 1, city: "Circle" },
  { seller: "kofi@questhub.local", category: "generators-solar", image: "generator", title: "2.5 kVA petrol generator, barely used", description: "Portable petrol generator bought last year and used only during a few outages. Starts on first pull, runs fridge, TV and lights comfortably. Comes with manual.", price: 2900, condition: "used", region: 2, city: "Adum", attrs: { capacity: 2.5 } },
  { seller: "ama@questhub.local", category: "shoes", image: "shoes", title: "Brown leather oxford shoes, size 43", description: "Genuine leather cap-toe oxfords, brand new in box. Comfortable for office and occasions. Size 43 (UK 9). Also available in black on request.", price: 650, condition: "new", region: 1, city: "Circle", attrs: { size: 43 } },
];

async function main() {
  const ids: Record<string, string> = {};
  for (const u of users) {
    const existing = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((x) => x.email === u.email);
    const id = existing?.id ?? (await db.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: u.name } })).data.user!.id;
    ids[u.email] = id;
    await db.from("profiles").update({
      role: u.role, city: u.city, region_id: u.region, bio: "bio" in u ? u.bio : null,
      is_verified: "verified" in u && u.verified, verified_at: "verified" in u && u.verified ? new Date().toISOString() : null,
    }).eq("id", id);
    if ("phone" in u) await db.from("profile_contacts").update({ phone: u.phone, whatsapp: u.phone, show_phone: true }).eq("user_id", id);
    console.log(`user  ${u.email} (${u.role})`);
  }

  const { data: cats } = await db.from("categories").select("id,slug,parent_id");
  const { data: defs } = await db.from("category_attributes").select("id,category_id,key,type");

  for (const s of listings) {
    const sellerId = ids[s.seller];
    const { data: dupe } = await db.from("listings").select("id").eq("seller_id", sellerId).eq("title", s.title).maybeSingle();
    if (dupe) { console.log(`skip  ${s.title}`); continue; }
    const cat = cats!.find((c) => c.slug === s.category)!;
    const { data: listing, error } = await db.from("listings").insert({
      seller_id: sellerId, category_id: cat.id, title: s.title, description: s.description, price: s.price,
      is_negotiable: Boolean(s.negotiable), condition: s.condition, region_id: s.region, city: s.city, status: "draft",
    }).select("id").single();
    if (error) throw error;

    const path = `${sellerId}/${listing.id}/${randomUUID()}.webp`;
    const up = await db.storage.from("listing-images").upload(path, readFileSync(`supabase/seed-images/${s.image}.webp`), { contentType: "image/webp" });
    if (up.error) throw up.error;
    await db.from("listing_images").insert({ listing_id: listing.id, storage_path: path, width: 1152, height: 864 });

    for (const [k, v] of Object.entries(s.attrs ?? {})) {
      const def = defs!.find((d) => d.key === k && (d.category_id === cat.id || d.category_id === cat.parent_id));
      if (!def) continue;
      await db.from("listing_attribute_values").insert({
        listing_id: listing.id, attribute_id: def.id,
        value_text: def.type === "text" || def.type === "select" ? String(v) : null,
        value_number: def.type === "number" ? Number(v) : null,
        value_bool: def.type === "boolean" ? Boolean(v) : null,
      });
    }
    const pub = await db.from("listings").update({ status: "published" }).eq("id", listing.id);
    if (pub.error) throw pub.error;

    if (s.promote) {
      const now = new Date();
      await db.from("promotions").insert({
        listing_id: listing.id, seller_id: sellerId, kind: s.promote, amount: 0, duration_days: 30,
        status: "active", payment_status: "test", starts_at: now.toISOString(), ends_at: new Date(+now + 30 * 864e5).toISOString(),
      });
    }
    console.log(`list  ${s.title}`);
  }
  console.log(`\nDone. Demo accounts use the password: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

# QuestHub

A marketplace and online store for Ghana, with three ways to earn:

1. **Marketplace (classifieds):** people and businesses post ads, buyers message sellers, moderators keep it clean. Revenue from paid promotions.
2. **QuestHub Store:** products you sell directly. Cart, delivery details, payment by Mobile Money or card (Hubtel), order tracking and fulfilment.
3. **Airtime and data:** MTN, Telecel and AirtelTigo top-ups through Hubtel, sold at your margin.
4. **Vendor shops:** businesses open a storefront (logo, banner, hours, delivery info), list products, and take online orders. Buyers pay the vendor directly (on delivery or by MoMo to the vendor), so QuestHub never holds vendor money. Revenue from featured-shop ads and listing boosts.

Customers can pay for store orders and top-ups with Mobile Money/card (Hubtel) or crypto (NOWPayments, off by default).

Prices in Ghana cedis, Africa/Accra time.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 and Supabase (Postgres, Auth, Storage, Realtime).

| Package | Version |
| --- | --- |
| next | 16.4.3 |
| react / react-dom | 19.3.0 |
| @supabase/supabase-js | 2.118.0 |
| @supabase/ssr | 0.12.7 |
| zod | 4.6.7 |
| react-hook-form | 7.91.0 |
| tailwindcss | 4.3.3 |
| vitest | 5.0.5 |
| @playwright/test | 1.64.1 |
| supabase (CLI) | 2.122.0 |

## What's included

- **Browse and search**: Postgres full-text + trigram search, category and attribute filters (make, year range, storage…), price, region, condition, sorting and pagination. All filtering happens in the database.
- **Selling**: an 8-step listing wizard with category-specific fields, photo upload (re-encoded in the browser to strip GPS data, reorderable, retryable), preview, drafts and submission for review. A seller dashboard with status filters, pause/resume, mark sold (to a named buyer), renew, analytics and promotion requests.
- **Trust and safety**: moderation queue, configurable prohibited-word flagging, posting limits, reports (listing, user, message), blocking, rate limits, verified-seller badges that only staff can grant, reviews only from confirmed buyers.
- **Messaging**: private buyer–seller chat per listing, persisted, realtime, read receipts, unread counts, older-message paging, report/block.
- **Admin**: dashboard, listing moderation, reports, users (suspend, verify, roles), categories, promotion plans, payments (read-only), settings, audit log.
- **Promotions**: featured and boosted placement, always labelled. Test mode records promotions as `test`, never as paid.
- **Store**: product catalogue with discounts and stock, cart, checkout with delivery fees by region (free over a threshold), stock reserved for 45 minutes until payment, order history and timeline, admin fulfilment (packing → shipped → delivered, refunds).
- **Airtime and data**: network detected from the number (with override for ported numbers), preset or custom airtime amounts, admin-managed data bundle catalogue, automatic delivery after payment, failures flagged for retry or refund.

## Vendor shops

- One shop per seller at `/shop/<name>`, reviewed by an admin before it's public (Admin → Shops; can be switched off in Settings). Admins can verify a business and feature it.
- Sellers tick "Let buyers order this online" on a listing; the listing quantity becomes stock and is reserved when an order is placed.
- Orders flow: requested → confirmed → out for delivery / ready for pickup → completed (or declined/cancelled, which returns stock). Buyer and vendor are notified at each step.
- Payment is between buyer and vendor: pay on delivery, or MoMo to the vendor's number (shown to the buyer only after the vendor confirms). QuestHub records "buyer says paid" and "vendor received payment" but never touches the money. Collecting money for vendors would need a Bank of Ghana licence or a licensed partner (for example split payments); the order model is ready for it.

## Crypto payments

- Off unless `CRYPTO_PAYMENTS=on` with NOWPayments keys, and an admin sets the GH₵/US$ rate (Admin → Settings → crypto exchange rate). In `PAYMENTS_MODE=test` crypto is simulated.
- Orders stay priced in cedis; the invoice is in US dollars at the admin rate, stored with the payment. Minimum US$1.
- The IPN endpoint checks the HMAC-SHA512 signature, then fetches the payment from NOWPayments and acts only on that. Only `finished` counts as paid; underpayments are logged on the order for staff to resolve.
- **Legal:** Ghana's VASP Act 2025 makes crypto legal to trade but not legal tender, and the Bank of Ghana licenses virtual-asset businesses. Confirm with the Bank of Ghana or a lawyer whether accepting crypto requires registration before switching it on.

## How payments stay safe

- Order totals are computed in the database from server-side prices; the browser never sends a price.
- Hubtel callbacks are not signed, so a callback only tells the server *which* payment to check. The server then asks Hubtel for the status and confirms the amount before calling `confirm_order_payment`, which only the service role can run.
- Confirmation is idempotent: duplicate callbacks are recorded once in `payment_events` and change nothing.
- Top-ups are sent only after a verified payment. A timed-out request is treated as "pending", not failed, to avoid double top-ups; staff retry only after checking the Hubtel dashboard.
- No card numbers or Mobile Money PINs ever touch QuestHub; customers pay on Hubtel's page.

## Security model

Authorisation is enforced in the database, not just the UI:

- Row-level security on every table and storage bucket. Users read and write only what they own; conversations are visible only to participants.
- Guard triggers reject direct changes to protected columns (role, verification, status, counters, payment fields) and enforce listing status transitions, so a seller can't publish their own listing or make themselves admin.
- Privileged actions are `SECURITY DEFINER` functions that check `is_admin()` and write to `admin_actions`.
- The secret key is used only by server code (seed script, future payment webhooks). It is never sent to the browser.

`tests/integration/security.test.ts` proves these rules with real buyer, seller and admin accounts.

## Local development

Requirements: Node 22+, Docker.

```bash
npm install
npm run db:start            # local Supabase in Docker (first run downloads images)
npx supabase status         # copy the API URL and keys into .env.local
cp .env.example .env.local  # then edit
npm run db:reset            # apply all migrations
npm run seed                # demo accounts, 8 listings, 5 store products, sample data bundles
npm run dev                 # http://localhost:3000
```

Demo accounts (password `Questhub-demo-2026`): `admin@questhub.local`, `ama@questhub.local` (verified seller), `kofi@questhub.local` (seller), `esi@questhub.local` (buyer). Local emails (confirmation, password reset) appear in Mailpit at http://127.0.0.1:54324.

To make someone an admin in any environment, run in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

## Database

Migrations live in `supabase/migrations` and run in order:

1. `core`: helpers, profiles and private contacts, settings, regions, categories and attributes
2. `listings`: listings, images, attribute values, status rules, moderation, stats
3. `engagement`: favourites, blocks, conversations, messages, notifications, reports, reviews
4. `admin_promotions_search`: audit log, promotions, payments, admin functions, search, storage buckets, realtime
5. `reference_data`: settings, 16 regions, 10 categories with subcategories and fields, promotion plans
6. `contact_flags` and 7. `admin_users`
8. `store`: products, cart, orders, order events, top-up bundles, checkout and fulfilment functions, product images bucket
9. `crypto_accessories`: crypto payment fields and dress-accessory categories
10. `vendor_shops` and 11. `featured_shop_plan`: shops, buy-online listings, shop cart, vendor orders, shop promotions

After changing the schema, run `npm run db:types` to regenerate `src/lib/supabase/database.types.ts`.

## Tests

```bash
npm run typecheck
npm run lint
npm test                    # unit tests
npm run test:integration    # database security tests (needs local Supabase)
npm run test:e2e            # browser journeys (needs local Supabase + seed)
```

## Deploying

1. Create a Supabase project (a dedicated one: auth users are shared per project).
2. Link it and push migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. In Supabase Auth settings set the Site URL to your domain and add `https://<domain>/auth/confirm` to redirect URLs. Configure custom SMTP so confirmation emails come from your domain.
4. Deploy to Vercel (or any Node host) with the environment variables from `.env.example`.
5. Set `CRON_SECRET` and call `GET /api/cron` every 15 minutes with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically). It expires old listings, ended promotions and unpaid orders (returning their stock).
6. Make your first admin with the SQL above.

## Going live with Hubtel

1. In the Hubtel dashboard, get your API client ID and secret, merchant account (POS sales) number, and for top-ups your prepaid deposit ID and the service IDs for each network's airtime and data. Put them in the environment variables listed in `.env.example`.
2. Ask Hubtel to allow-list your server's IP for the transaction status API, and confirm the status and top-up endpoint URLs for your account. Override `HUBTEL_STATUS_URL` / `HUBTEL_TOPUP_URL` if theirs differ.
3. Set a long random `HUBTEL_CALLBACK_TOKEN`.
4. In Admin → Data bundles, replace the sample bundles with your real ones, using Hubtel's exact bundle codes and your selling prices.
5. Set `PAYMENTS_MODE=live` and make one small real purchase of each type (store item, airtime, data) before announcing.
6. Fund your Hubtel prepaid balance for top-ups and check it regularly; failed top-ups show under Admin → Store orders → Needs attention.

Before taking real money, register the business, confirm Hubtel's merchant requirements, and have a lawyer review the terms and privacy pages (they're templates).

**Backups**: enable Supabase point-in-time recovery on paid plans, or schedule `supabase db dump`. Storage files are not included in database backups; back up the `listing-images` and `avatars` buckets separately.

## Configuration

- Brand name, tagline and market settings: `src/config/site.ts`
- Colours and fonts: `src/app/globals.css`
- Logo: `src/components/layout/logo.tsx`
- Moderation rules, limits and prohibited words: Admin → Settings

## Known limitations

- Hubtel's public documentation doesn't publish the status-check and top-up response formats in full. The integration follows their documented checkout API and common response codes; verify it with one real transaction of each type before launch (see "Going live").
- Refunds are recorded in QuestHub but sent manually from the Hubtel dashboard.
- Promotion payments still use test-mode activation; store and top-up checkout use Hubtel.
- Store cart requires sign-in (no guest checkout).
- The six dress-accessory store products are seeded hidden: add real photos in Admin → Store products and switch them on sale.
- Email/SMS notifications are in-app only until an email provider is configured.
- Demo photos are AI-generated.
- Listing images are served at full size; enable Supabase image transformations (Pro plan) for resized thumbnails.
- Abandoned uploads from failed saves are deleted immediately; a periodic sweep of orphaned storage files is not yet scheduled.

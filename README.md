# QuestHub

A classifieds marketplace for Ghana: people and businesses list items, buyers search and message sellers, moderators keep it clean. Prices in Ghana cedis, Africa/Accra time.

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
npm run seed                # demo accounts + 8 listings with photos
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
5. Schedule the maintenance functions daily (Supabase cron or an external scheduler): `select public.expire_listings(); select public.expire_promotions();`
6. Make your first admin with the SQL above.

**Backups**: enable Supabase point-in-time recovery on paid plans, or schedule `supabase db dump`. Storage files are not included in database backups; back up the `listing-images` and `avatars` buckets separately.

## Configuration

- Brand name, tagline and market settings: `src/config/site.ts`
- Colours and fonts: `src/app/globals.css`
- Logo: `src/components/layout/logo.tsx`
- Moderation rules, limits and prohibited words: Admin → Settings

## Known limitations

- Online payments are off. Promotions can be requested and activated in test mode; real checkout is the next phase.
- Email/SMS notifications are in-app only until an email provider is configured.
- Demo photos are AI-generated.
- Listing images are served at full size; enable Supabase image transformations (Pro plan) for resized thumbnails.
- Abandoned uploads from failed saves are deleted immediately; a periodic sweep of orphaned storage files is not yet scheduled.

import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, statusLabel } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { ListingRowActions } from "./row-actions";

export const metadata: Metadata = { title: "Your listings" };

const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "live", label: "Live", statuses: ["published"] },
  { key: "review", label: "In review", statuses: ["pending_review"] },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "sold", label: "Sold", statuses: ["sold"] },
  { key: "attention", label: "Needs attention", statuses: ["rejected", "expired", "removed"] },
] as const;

const tone: Record<string, "brand" | "success" | "gold" | "danger" | "neutral"> = {
  published: "success", pending_review: "brand", draft: "neutral", paused: "neutral", sold: "neutral", rejected: "danger", expired: "gold", removed: "danger",
};

function expiresWithinAWeek(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() - Date.now() < 7 * 864e5);
}

export default async function SellerListingsPage({ searchParams }: PageProps<"/seller-dashboard/listings">) {
  const viewer = await requireSeller();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("id,slug,title,price,currency,status,moderation_note,view_count,contact_count,expires_at,updated_at,images:listing_images(storage_path,sort_order),conversations(buyer_id,buyer:profiles!conversations_buyer_id_fkey(display_name))")
    .eq("seller_id", viewer.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filter.statuses) query = query.in("status", filter.statuses as unknown as ("published")[]);
  const [{ data: listings, error }, { data: counts }] = await Promise.all([
    query,
    supabase.from("listings").select("status").eq("seller_id", viewer.id),
  ]);
  if (error) throw error;
  const countFor = (statuses: readonly string[] | null) => (counts ?? []).filter((c) => !statuses || statuses.includes(c.status)).length;

  return (
    <>
      <PageHeader title="Your listings" actions={<ButtonLink href="/seller-dashboard/listings/new"><Plus size={16} aria-hidden /> Post an ad</ButtonLink>} />
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/seller-dashboard/listings" : `/seller-dashboard/listings?status=${f.key}`} aria-current={f === filter ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm", f === filter ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-brand")}>
            {f.label} <span className="tabular opacity-70">{countFor(f.statuses)}</span>
          </Link>
        ))}
      </nav>

      {!listings?.length ? (
        <EmptyState title={filter.key === "all" ? "You haven't posted anything yet" : `No ${filter.label.toLowerCase()} listings`} body="Listings you create appear here with their status, views and messages." action={<ButtonLink href="/seller-dashboard/listings/new">Post an ad</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {listings.map((l) => {
            const cover = [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0];
            const buyers = l.conversations.map((c) => ({ id: c.buyer_id, name: c.buyer?.display_name ?? "Buyer" }));
            return (
              <li key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-[8px] bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {cover ? <img src={listingImageUrl(cover.storage_path)!} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/listing/${l.slug}`} className="line-clamp-1 font-medium hover:text-brand">{l.title}</Link>
                    <p className="font-display font-bold tabular">{formatPrice(l.price, l.currency)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                      <Badge tone={tone[l.status]}>{statusLabel[l.status]}</Badge>
                      <span className="tabular">{l.view_count} views</span>
                      <span className="tabular">{l.contact_count} contacts</span>
                      {l.status === "published" && l.expires_at ? <span>Expires {formatDate(l.expires_at)}</span> : null}
                    </div>
                    {l.moderation_note && ["rejected", "draft", "removed"].includes(l.status) ? (
                      <p className="mt-1 text-xs text-danger">Moderator note: {l.moderation_note}</p>
                    ) : null}
                  </div>
                </div>
                <ListingRowActions listing={{ id: l.id, slug: l.slug, status: l.status, expiringSoon: expiresWithinAWeek(l.expires_at) }} buyers={buyers} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

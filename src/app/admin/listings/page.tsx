import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, statusLabel, timeAgo } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { Badge } from "@/components/ui/misc";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterBar, Pager, Table, Tabs } from "../ui";
import { ListingModeration } from "./moderation";

const STATUSES = ["pending_review", "published", "rejected", "removed", "paused", "sold", "draft", "expired"] as const;
const PAGE = 25;

export default async function AdminListings({ searchParams }: PageProps<"/admin/listings">) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof STATUSES)[number]) : "pending_review";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("id,slug,title,price,currency,status,flagged_terms,moderation_note,submitted_at,updated_at,seller:profiles!listings_seller_id_fkey(id,display_name,status),category:categories(name),images:listing_images(storage_path,sort_order)", { count: "exact" })
    .eq("status", status)
    .order(status === "pending_review" ? "submitted_at" : "updated_at", { ascending: status === "pending_review" })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const [{ data, count, error }, { data: all }] = await Promise.all([query, supabase.from("listings").select("status")]);
  if (error) throw error;
  const countOf = (s: string) => (all ?? []).filter((l) => l.status === s).length;

  return (
    <>
      <AdminHeader title="Listings" description="Oldest submissions first. Flagged words come from the prohibited terms in Settings." />
      <Tabs base="/admin/listings" current={status} tabs={STATUSES.map((s) => ({ key: s, label: statusLabel[s], count: countOf(s) }))} />
      <FilterBar>
        <input type="hidden" name="status" value={status} />
        <Input name="q" defaultValue={q} placeholder="Search titles" className="h-10 w-64" aria-label="Search titles" />
        <Button type="submit" variant="secondary">Search</Button>
      </FilterBar>
      <Table head={["Listing", "Seller", "Category", "Submitted", "Actions"]} empty={!data?.length}>
        {data?.map((l) => {
          const cover = [...l.images].sort((a, b) => a.sort_order - b.sort_order)[0];
          return (
            <tr key={l.id}>
              <td className="px-3 py-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover ? listingImageUrl(cover.storage_path)! : ""} alt="" className="h-14 w-16 shrink-0 rounded-[6px] bg-paper object-cover" />
                  <div className="min-w-0">
                    <Link href={`/listing/${l.slug}`} target="_blank" className="font-medium hover:text-brand">{l.title}</Link>
                    <p className="font-display text-sm font-semibold tabular">{formatPrice(l.price, l.currency)}</p>
                    {l.flagged_terms.length ? <Badge tone="danger">Flagged: {l.flagged_terms.join(", ")}</Badge> : null}
                    {l.moderation_note ? <p className="mt-1 text-xs text-ink-faint">Note: {l.moderation_note}</p> : null}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <Link href={`/admin/users?q=${encodeURIComponent(l.seller?.display_name ?? "")}`} className="hover:text-brand">{l.seller?.display_name}</Link>
                {l.seller?.status === "suspended" ? <div><Badge tone="danger">Suspended</Badge></div> : null}
              </td>
              <td className="px-3 py-3 text-ink-soft">{l.category?.name}</td>
              <td className="px-3 py-3 text-ink-soft">{timeAgo(l.submitted_at ?? l.updated_at)}</td>
              <td className="px-3 py-3"><ListingModeration id={l.id} status={l.status} /></td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/listings" params={{ status, q }} page={page} pages={Math.ceil((count ?? 0) / PAGE)} />
    </>
  );
}

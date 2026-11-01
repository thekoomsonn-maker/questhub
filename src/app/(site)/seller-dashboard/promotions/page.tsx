import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { PromoteForm, CancelPromotionButton } from "./promote-form";

export const metadata: Metadata = { title: "Promotions" };

const statusText: Record<string, string> = { pending_payment: "Awaiting payment", active: "Active", expired: "Ended", cancelled: "Cancelled" };

export default async function PromotionsPage({ searchParams }: PageProps<"/seller-dashboard/promotions">) {
  const viewer = await requireSeller();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: plans }, { data: listings }, { data: history }] = await Promise.all([
    supabase.from("promotion_plans").select("id,name,kind,duration_days,price,currency,description").eq("is_active", true).order("sort_order"),
    supabase.from("listings").select("id,title").eq("seller_id", viewer.id).eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("promotions").select("id,kind,amount,currency,duration_days,status,payment_status,starts_at,ends_at,created_at,listing:listings(title,slug)").eq("seller_id", viewer.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <>
      <PageHeader title="Promotions" description="Get more buyers to see a live listing. Promoted listings are always labelled for buyers." />
      {!env.checkoutEnabled ? (
        <div className="mb-4">
          <FormMessage tone="info">Online payment isn&apos;t switched on yet. You can request a promotion now; it starts once payment is confirmed.</FormMessage>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <h2 className="font-display text-lg font-semibold">Promote a listing</h2>
          {listings?.length && plans?.length ? (
            <PromoteForm listings={listings} plans={plans.map((p) => ({ ...p, priceLabel: formatPrice(p.price, p.currency) }))} defaultListing={typeof sp.listing === "string" ? sp.listing : undefined} />
          ) : (
            <p className="mt-2 text-sm text-ink-soft">You need at least one live listing to promote.</p>
          )}
        </Card>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">History</h2>
          {!history?.length ? (
            <EmptyState title="No promotions yet" body="Requests and active promotions appear here." />
          ) : (
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {history.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.listing?.title ?? "Deleted listing"}</p>
                    <p className="text-ink-faint">
                      {p.kind === "featured" ? "Featured" : "Boost"} · {p.duration_days} days · {formatPrice(p.amount, p.currency)}
                      {p.status === "active" && p.ends_at ? ` · until ${formatDate(p.ends_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.payment_status === "test" ? <Badge tone="gold">Test mode, not paid</Badge> : null}
                    <Badge tone={p.status === "active" ? "success" : p.status === "pending_payment" ? "brand" : "neutral"}>{statusText[p.status]}</Badge>
                    {p.status === "pending_payment" ? <CancelPromotionButton id={p.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

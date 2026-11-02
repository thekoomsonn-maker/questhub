import Link from "next/link";
import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pluralize } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Seller dashboard" };

export default async function SellerOverviewPage() {
  const viewer = await requireSeller();
  const supabase = await createClient();
  const [{ data: listings }, unread] = await Promise.all([
    supabase.from("listings").select("status,view_count,contact_count").eq("seller_id", viewer.id),
    supabase.rpc("unread_conversation_count"),
  ]);
  const all = listings ?? [];
  const count = (s: string) => all.filter((l) => l.status === s).length;
  const views = all.reduce((n, l) => n + l.view_count, 0);
  const contacts = all.reduce((n, l) => n + l.contact_count, 0);

  const tiles = [
    { label: "Live listings", value: count("published"), href: "/seller-dashboard/listings?status=live" },
    { label: "In review", value: count("pending_review"), href: "/seller-dashboard/listings?status=review" },
    { label: "Needs attention", value: count("rejected") + count("expired"), href: "/seller-dashboard/listings?status=attention" },
    { label: "Unread chats", value: unread.data ?? 0, href: "/messages" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Hello, {viewer.profile.display_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink-soft">Your listings have had {pluralize(views, "view")} and {pluralize(contacts, "contact")} in total.</p>
        </div>
        <ButtonLink href="/seller-dashboard/listings/new">Post an ad</ButtonLink>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="p-4 hover:border-brand">
              <p className="text-sm text-ink-soft">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular">{t.value}</p>
            </Card>
          </Link>
        ))}
      </div>
      {all.length === 0 ? (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-bold">Post your first ad</h2>
          <p className="mt-1 text-sm text-ink-soft">It takes about five minutes. Have your photos ready.</p>
          <ButtonLink href="/seller-dashboard/listings/new" className="mt-4">Start</ButtonLink>
        </Card>
      ) : null}
    </>
  );
}

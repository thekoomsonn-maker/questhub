import Link from "next/link";
import type { Metadata } from "next";
import { Bell, ChevronRight, Heart, LayoutDashboard, MessageCircle, Package, Settings, ShieldCheck, Store } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Badge, Card } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { UserAvatar } from "@/components/user-avatar";
import { signOut } from "../(auth)/actions";
import { becomeSeller } from "./actions";
import { DeletionControls } from "./deletion-controls";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const viewer = await requireViewer("/account");
  const { profile } = viewer;
  const sp = await searchParams;
  const isSeller = profile.role !== "buyer";

  const links = [
    { href: "/account/profile", label: "Edit profile and contact settings", icon: Settings },
    { href: "/orders", label: "Orders and top-ups", icon: Package },
    { href: "/favorites", label: "Saved items", icon: Heart },
    { href: "/messages", label: "Messages", icon: MessageCircle },
    { href: "/notifications", label: "Notifications", icon: Bell },
    ...(isSeller ? [{ href: "/seller-dashboard", label: "Seller dashboard", icon: LayoutDashboard }] : []),
    ...(profile.role === "admin" ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {sp.password === "updated" ? <div className="mb-4"><FormMessage tone="success">Password updated.</FormMessage></div> : null}
      {profile.status === "suspended" ? (
        <div className="mb-4">
          <FormMessage>
            Your account is suspended{profile.suspended_reason ? `: ${profile.suspended_reason}` : ""}. You can still browse, but you can&apos;t post or send messages. Contact support to appeal.
          </FormMessage>
        </div>
      ) : null}

      <Card className="flex items-center gap-4 p-5">
        <UserAvatar name={profile.display_name} path={profile.avatar_path} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold">{profile.display_name}</h1>
          <p className="truncate text-sm text-ink-soft">{viewer.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="brand">{profile.role === "admin" ? "Administrator" : isSeller ? "Seller" : "Buyer"}</Badge>
            {profile.is_verified ? <Badge tone="success"><ShieldCheck size={12} aria-hidden />Verified seller</Badge> : null}
            <Badge>Joined {formatDate(profile.created_at)}</Badge>
          </div>
        </div>
      </Card>

      {!isSeller && profile.status === "active" ? (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 text-brand" aria-hidden />
            <div>
              <h2 className="font-medium">Start selling</h2>
              <p className="text-sm text-ink-soft">Post your first ad for free. You can switch selling on in one step.</p>
            </div>
          </div>
          <form action={becomeSeller}>
            <Button type="submit">Start selling</Button>
          </form>
        </Card>
      ) : null}

      <Card className="mt-4 divide-y divide-line">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-5 py-4 text-sm hover:bg-paper">
            <Icon size={18} className="text-ink-faint" aria-hidden />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-ink-faint" aria-hidden />
          </Link>
        ))}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <form action={signOut}>
          <Button type="submit" variant="secondary">Sign out</Button>
        </form>
        <DeletionControls requestedAt={profile.deletion_requested_at} />
      </div>
    </div>
  );
}

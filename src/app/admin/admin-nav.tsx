"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, CreditCard, Download, Flag, FolderTree, GalleryHorizontalEnd, LayoutDashboard, ListChecks,
  Megaphone, Package, ScrollText, Settings, ShoppingBag, Smartphone, Store, TrendingUp, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { staffCan, type StaffArea, type StaffLevel } from "@/lib/staff";

type Item = { href: string; label: string; icon: typeof Store; area: StaffArea | null };

const groups: { label: string; items: Item[] }[] = [
  { label: "Business", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, area: null },
    { href: "/admin/vendors", label: "Vendor performance", icon: TrendingUp, area: "commerce" },
    { href: "/admin/exports", label: "Exports", icon: Download, area: "insights" },
  ] },
  { label: "Store", items: [
    { href: "/admin/orders", label: "Store orders", icon: Package, area: "commerce" },
    { href: "/admin/products", label: "Products", icon: ShoppingBag, area: "commerce" },
    { href: "/admin/bundles", label: "Data bundles", icon: Smartphone, area: "commerce" },
    { href: "/admin/banners", label: "Banners", icon: GalleryHorizontalEnd, area: "commerce" },
    { href: "/admin/promotions", label: "Promotions", icon: Megaphone, area: "commerce" },
    { href: "/admin/categories", label: "Categories", icon: FolderTree, area: "commerce" },
  ] },
  { label: "Trust & safety", items: [
    { href: "/admin/listings", label: "Listings", icon: ListChecks, area: "safety" },
    { href: "/admin/reports", label: "Reports", icon: Flag, area: "safety" },
    { href: "/admin/users", label: "Users", icon: Users, area: "safety" },
    { href: "/admin/shops", label: "Shops", icon: Store, area: "safety" },
  ] },
  { label: "Owner", items: [
    { href: "/admin/staff", label: "Staff", icon: BadgeCheck, area: "owner" },
    { href: "/admin/payments", label: "Payments", icon: CreditCard, area: "owner" },
    { href: "/admin/settings", label: "Settings", icon: Settings, area: "owner" },
    { href: "/admin/audit-log", label: "Audit log", icon: ScrollText, area: "owner" },
  ] },
];

export function AdminNav({ level }: { level: StaffLevel }) {
  const pathname = usePathname();
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.area === null || staffCan(level, i.area)) }))
    .filter((g) => g.items.length);
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-2 pb-2 lg:pb-4">
      <div className="flex gap-1 lg:flex-col lg:gap-4">
        {visible.map((g) => (
          <div key={g.label} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-1 text-xs font-medium text-ink-faint lg:block">{g.label}</p>
            <ul className="flex gap-1 lg:flex-col">
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link href={href} aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-field)] px-3 py-2 text-sm", active ? "bg-brand text-white" : "text-ink-soft hover:bg-brand-tint hover:text-brand")}>
                      <Icon size={16} aria-hidden /> {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

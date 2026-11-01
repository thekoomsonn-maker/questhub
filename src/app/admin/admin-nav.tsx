"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FolderTree, Flag, LayoutDashboard, ListChecks, Megaphone, Package, ScrollText, Settings, ShoppingBag, Smartphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/listings", label: "Listings", icon: ListChecks },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Store orders", icon: Package },
  { href: "/admin/products", label: "Store products", icon: ShoppingBag },
  { href: "/admin/bundles", label: "Data bundles", icon: Smartphone },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-2 pb-2 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map(({ href, label, icon: Icon }) => {
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
    </nav>
  );
}

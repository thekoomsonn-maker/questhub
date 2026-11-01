"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/seller-dashboard", label: "Overview", exact: true },
  { href: "/seller-dashboard/listings", label: "Listings" },
  { href: "/seller-dashboard/shop", label: "My shop" },
  { href: "/seller-dashboard/orders", label: "Orders" },
  { href: "/seller-dashboard/messages", label: "Messages" },
  { href: "/seller-dashboard/analytics", label: "Analytics" },
  { href: "/seller-dashboard/promotions", label: "Promotions" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seller dashboard" className="-mx-4 overflow-x-auto border-b border-line px-4">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href) && !(t.href === "/seller-dashboard/listings" && pathname.endsWith("/new"));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium", active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

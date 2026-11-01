"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, MessageCircle, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/categories", label: "Categories", icon: LayoutGrid, match: (p: string) => p.startsWith("/categories") },
  { href: "/sell", label: "Sell", icon: PlusCircle, match: (p: string) => p === "/sell" || p.startsWith("/seller-dashboard/listings/new") },
  { href: "/messages", label: "Messages", icon: MessageCircle, match: (p: string) => p.startsWith("/messages") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") || p.startsWith("/seller-dashboard") },
];

/** Mobile-only bottom navigation. */
export function BottomNav({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          const isSell = label === "Sell";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-brand" : "text-ink-faint",
                  isSell && "text-brand",
                )}
              >
                <Icon size={isSell ? 26 : 22} strokeWidth={active || isSell ? 2.2 : 1.8} aria-hidden />
                {label}
                {label === "Messages" && unreadMessages > 0 ? (
                  <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-danger" aria-label={`${unreadMessages} unread`} />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

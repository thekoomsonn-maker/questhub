import Link from "next/link";
import { Suspense } from "react";
import { Bell, Heart, MessageCircle, Plus, Shield, User } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getViewerCounts } from "@/lib/data/viewer";
import { getRegions } from "@/lib/data/catalog";
import { site } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { SearchBar } from "./search-bar";
import { LocationSelect } from "./location-select";
import { Logo } from "./logo";

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white tabular">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function IconLink({ href, label, count, children }: { href: string; label: string; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count} unread)` : label}
      title={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-brand-tint hover:text-brand"
    >
      {children}
      <CountBadge count={count ?? 0} />
    </Link>
  );
}

export async function SiteHeader() {
  const [viewer, counts, regions] = await Promise.all([getViewer(), getViewerCounts(), getRegions()]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0" aria-label={`${site.name} home`}>
          <Logo />
        </Link>
        <div className="hidden md:block">
          <Suspense fallback={<div className="h-11 w-44" />}>
            <LocationSelect regions={regions} />
          </Suspense>
        </div>
        <div className="hidden flex-1 md:block">
          <Suspense fallback={<div className="h-11" />}>
            <SearchBar />
          </Suspense>
        </div>
        <nav className="ml-auto flex items-center gap-1 md:ml-0" aria-label="Account">
          {viewer ? (
            <>
              {viewer.profile.role === "admin" ? (
                <IconLink href="/admin" label="Admin">
                  <Shield size={20} />
                </IconLink>
              ) : null}
              <div className="hidden items-center gap-1 md:flex">
                <IconLink href="/favorites" label="Saved">
                  <Heart size={20} />
                </IconLink>
                <IconLink href="/messages" label="Messages" count={counts.unreadMessages}>
                  <MessageCircle size={20} />
                </IconLink>
              </div>
              <IconLink href="/notifications" label="Notifications" count={counts.unreadNotifications}>
                <Bell size={20} />
              </IconLink>
              <div className="hidden md:block">
                <IconLink href="/account" label="Account">
                  <User size={20} />
                </IconLink>
              </div>
            </>
          ) : (
            <Link href="/login" className="px-3 text-sm font-medium text-ink-soft hover:text-brand">
              Sign in
            </Link>
          )}
          <ButtonLink href="/sell" size="md" className="ml-1 hidden md:inline-flex">
            <Plus size={18} aria-hidden />
            Sell
          </ButtonLink>
        </nav>
      </div>
      <div className="border-t border-line px-4 py-2 md:hidden">
        <Suspense fallback={<div className="h-11" />}>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}

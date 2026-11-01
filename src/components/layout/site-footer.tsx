import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "./logo";

const groups = [
  {
    title: "Marketplace",
    links: [
      { href: "/categories", label: "All categories" },
      { href: "/search", label: "Browse listings" },
      { href: "/sell", label: "Post an ad" },
      { href: "/shops", label: "Shops" },
      { href: "/store", label: "QuestHub Store" },
      { href: "/airtime", label: "Airtime & data" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/account", label: "Account" },
      { href: "/seller-dashboard", label: "Seller dashboard" },
      { href: "/seller-dashboard/shop", label: "Open a shop" },
      { href: "/favorites", label: "Saved items" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/safety", label: "Safety tips" },
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-20 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">{site.tagline}. Meet in public, inspect before you pay.</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold text-ink">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-soft hover:text-brand">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-ink-faint">
          © {new Date().getFullYear()} {site.name}. Prices in Ghana cedis (GH₵).
        </p>
      </div>
    </footer>
  );
}

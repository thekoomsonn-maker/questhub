import Link from "next/link";
import { cn } from "@/lib/utils";

export type Banner = {
  id: string; title: string; body: string | null; link_url: string | null; link_label: string | null; tone: "brand" | "gold" | "ink";
};

const toneClass = {
  brand: "bg-brand-tint text-ink border-brand/20",
  gold: "bg-gold-tint text-ink border-gold/40",
  ink: "bg-ink text-white border-ink",
} as const;

export function BannerView({ banner }: { banner: Banner }) {
  const external = banner.link_url?.startsWith("https://");
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border px-4 py-3", toneClass[banner.tone])}>
      <p className="min-w-0 flex-1 text-sm">
        <strong className="font-semibold">{banner.title}</strong>
        {banner.body ? <span className={cn("ml-2", banner.tone === "ink" ? "text-white/80" : "text-ink-soft")}>{banner.body}</span> : null}
      </p>
      {banner.link_url && banner.link_label ? (
        <Link href={banner.link_url} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium", banner.tone === "ink" ? "bg-white text-ink" : "bg-ink text-white")}>
          {banner.link_label}
        </Link>
      ) : null}
    </div>
  );
}


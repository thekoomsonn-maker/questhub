import { site } from "@/config/site";

/** Wordmark: a woven Q glyph plus the brand name. Replace this component to rebrand. */
export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill={inverted ? "#fff" : "var(--brand)"} />
        <circle cx="15" cy="15" r="7.5" fill="none" stroke={inverted ? "var(--brand)" : "#fff"} strokeWidth="3.2" />
        <path d="M19.5 19.5 25 25" stroke="var(--gold)" strokeWidth="3.6" strokeLinecap="round" />
      </svg>
      <span
        className={`font-display text-[22px] font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}
      >
        {site.name}
      </span>
    </span>
  );
}

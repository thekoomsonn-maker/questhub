import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Server-rendered filter bar: a GET form so filters live in the URL. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <form method="get" className="mb-4 flex flex-wrap items-end gap-2">{children}</form>;
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filter">
      {tabs.map((t) => (
        <Link key={t.key} href={t.key ? `${base}?status=${t.key}` : base} aria-current={current === t.key ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1.5 text-sm", current === t.key ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink")}>
          {t.label}{t.count !== undefined ? <span className="ml-1 tabular opacity-70">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-line bg-paper text-left text-xs text-ink-soft">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {empty ? <tr><td colSpan={head.length} className="px-3 py-10 text-center text-ink-soft">Nothing here.</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ base, params, page, pages }: { base: string; params: Record<string, string | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `${base}?${q}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} className="rounded border border-line-strong bg-surface px-3 py-1.5">Previous</Link> : null}
      <span className="text-ink-soft tabular">Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className="rounded border border-line-strong bg-surface px-3 py-1.5">Next</Link> : null}
    </nav>
  );
}

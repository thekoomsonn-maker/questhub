import type { ReactNode } from "react";

/** Long-form page wrapper for policy and help pages. */
export function Prose({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      {updated ? <p className="mt-1 text-sm text-ink-faint">Last updated {updated}</p> : null}
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_a]:text-brand [&_a]:underline">
        {children}
      </div>
    </article>
  );
}

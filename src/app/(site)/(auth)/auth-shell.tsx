import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

export function AuthShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_1.1fr] md:py-16">
      <section className="hidden flex-col justify-center md:flex">
        <h2 className="font-display text-3xl font-bold leading-tight">
          From Accra to Tamale, buyers are looking for what you have.
        </h2>
        <ul className="mt-6 space-y-3 text-sm text-ink-soft">
          <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-success" aria-hidden />Every new listing is checked before it goes live.</li>
          <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-success" aria-hidden />Your phone number stays hidden unless you choose to share it.</li>
          <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-success" aria-hidden />Chat with buyers in the app. Report anyone who behaves badly.</li>
        </ul>
      </section>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {intro ? <p className="mt-1 text-sm text-ink-soft">{intro}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 border-t border-line pt-4 text-sm text-ink-soft">{footer}</div> : null}
      </section>
    </div>
  );
}

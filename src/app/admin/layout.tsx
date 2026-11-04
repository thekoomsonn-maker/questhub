import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";
import { AdminNav } from "./admin-nav";
import { staffLevelLabel, staffLevelOf } from "@/lib/staff";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  const level = staffLevelOf(viewer.profile)!;
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:overflow-y-auto lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4">
          <Link href="/" aria-label="Back to site"><Logo /></Link>
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-white">{staffLevelLabel[level]}</span>
        </div>
        <AdminNav level={level} />
        <p className="hidden px-4 pt-6 text-xs text-ink-faint lg:block">Signed in as {viewer.profile.display_name}. Every action here is recorded in the audit log.</p>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

"use client";

import { MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Region } from "@/lib/data/catalog";

/** Picks a region; on search/category pages it filters results in place. */
export function LocationSelect({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("region") ?? "";

  return (
    <label className="relative flex items-center">
      <span className="sr-only">Location</span>
      <MapPin size={16} className="pointer-events-none absolute left-3 text-brand" aria-hidden />
      <select
        value={current}
        onChange={(e) => {
          const filterable = pathname === "/search" || pathname.startsWith("/categories/");
          const next = new URLSearchParams(filterable ? params : undefined);
          if (e.target.value) next.set("region", e.target.value);
          else next.delete("region");
          next.delete("page");
          router.push(`${filterable ? pathname : "/search"}${next.size ? `?${next}` : ""}`);
        }}
        className="h-11 w-44 appearance-none rounded-full border border-line-strong bg-surface pl-8 pr-3 text-sm font-medium text-ink focus:border-brand focus:outline-none"
      >
        <option value="">All of Ghana</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Suggestion = { kind: string; label: string; slug: string | null };

/** Keyword search with debounced suggestions (categories + similar titles). */
export function SearchBar({ large = false, autoFocus = false }: { large?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const { data } = await createClient().rpc("search_suggestions", { p_query: q });
      if (id === requestId.current) setSuggestions((data as Suggestion[]) ?? []);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function go(s?: Suggestion) {
    setOpen(false);
    if (s?.kind === "category" && s.slug) {
      router.push(`/categories/${s.slug}`);
      return;
    }
    const q = (s?.label ?? query).trim();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    const region = params.get("region");
    if (region) next.set("region", region);
    router.push(`/search${next.size ? `?${next}` : ""}`);
  }

  const showList = open && query.trim().length >= 2 && suggestions.length > 0;

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        go(active >= 0 ? suggestions[active] : undefined);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search listings
      </label>
      <Search
        className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint", large && "left-4")}
        size={large ? 22 : 18}
        aria-hidden
      />
      <input
        id={`${listId}-input`}
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Search phones, cars, apartments…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={cn(
          "w-full rounded-full border border-line-strong bg-surface pl-10 pr-24 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          large ? "h-14 pl-12 text-base shadow-sm" : "h-11",
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover",
          large ? "h-11 px-6" : "h-8",
        )}
      >
        Search
      </button>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface py-1 text-left shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-ink",
                i === active && "bg-brand-tint",
              )}
            >
              {s.kind === "category" ? (
                <>
                  <Tag size={14} className="text-brand" aria-hidden />
                  <span>
                    {s.label} <span className="text-ink-faint">in categories</span>
                  </span>
                </>
              ) : (
                <>
                  <Search size={14} className="text-ink-faint" aria-hidden />
                  <span className="truncate">{s.label}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { CategoryAttribute, Region } from "@/lib/data/catalog";

type Values = Record<string, string | undefined>;

/**
 * Filter panel. Submits as a GET form so filters live in the URL (shareable,
 * back-button friendly, server-rendered results). On mobile it opens as a sheet.
 */
export function SearchFilters({
  action,
  values,
  regions,
  attributes,
  hasActive,
}: {
  action: string;
  values: Values;
  regions: Region[];
  attributes: CategoryAttribute[];
  hasActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const filterable = attributes.filter((a) => a.is_filterable && a.type !== "text").slice(0, 6);

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    setOpen(false);
    router.push(params.size ? `${action}?${params}` : action);
  }

  const panel = (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="flex flex-col gap-4"
      aria-label="Filters"
    >
      {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
      {values.sort ? <input type="hidden" name="sort" value={values.sort} /> : null}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Price (GH₵)</legend>
        <div className="flex items-center gap-2">
          <Input name="min" inputMode="numeric" placeholder="Min" defaultValue={values.min} aria-label="Minimum price" />
          <span className="text-ink-faint">–</span>
          <Input name="max" inputMode="numeric" placeholder="Max" defaultValue={values.max} aria-label="Maximum price" />
        </div>
      </fieldset>
      <Field id="f-region" label="Region">
        <Select id="f-region" name="region" defaultValue={values.region ?? ""}>
          <option value="">All of Ghana</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
      <Field id="f-condition" label="Condition">
        <Select id="f-condition" name="condition" defaultValue={values.condition ?? ""}>
          <option value="">Any</option>
          <option value="new">Brand new</option>
          <option value="used">Used</option>
          <option value="refurbished">Refurbished</option>
        </Select>
      </Field>
      {filterable.map((a) =>
        a.type === "number" ? (
          <fieldset key={a.id} className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{a.label}{a.unit ? ` (${a.unit})` : ""}</legend>
            <div className="flex items-center gap-2">
              <Input name={`${a.key}_min`} inputMode="numeric" placeholder="From" defaultValue={values[`${a.key}_min`]} aria-label={`${a.label} from`} />
              <span className="text-ink-faint">–</span>
              <Input name={`${a.key}_max`} inputMode="numeric" placeholder="To" defaultValue={values[`${a.key}_max`]} aria-label={`${a.label} to`} />
            </div>
          </fieldset>
        ) : (
          <Field key={a.id} id={`f-${a.key}`} label={a.label}>
            <Select id={`f-${a.key}`} name={a.key} defaultValue={values[a.key] ?? ""}>
              <option value="">Any</option>
              {a.type === "boolean" ? (
                <>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </>
              ) : (
                (a.options as string[]).map((o) => <option key={o} value={o}>{o}</option>)
              )}
            </Select>
          </Field>
        ),
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Apply filters</Button>
        {hasActive ? (
          <Button type="button" variant="secondary" onClick={() => { setOpen(false); router.push(values.q ? `${action}?q=${encodeURIComponent(values.q)}` : action); }}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} aria-expanded={open}>
          <SlidersHorizontal size={16} aria-hidden /> Filters{hasActive ? " (on)" : ""}
        </Button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button className="absolute inset-0 bg-ink/40" aria-label="Close filters" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[20px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Filters</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-paper"><X size={18} /></button>
            </div>
            {panel}
          </div>
        </div>
      ) : null}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-[var(--radius-card)] border border-line bg-surface p-4">{panel}</div>
      </aside>
    </>
  );
}

export function SortSelect({ value, hrefFor }: { value: string; hrefFor: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">Sort</span>
      <select
        value={value}
        onChange={(e) => router.push(hrefFor[e.target.value])}
        className="h-10 rounded-[var(--radius-field)] border border-line-strong bg-surface px-2 text-sm"
      >
        {"relevance" in hrefFor ? <option value="relevance">Best match</option> : null}
        <option value="newest">Newest</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>
    </label>
  );
}

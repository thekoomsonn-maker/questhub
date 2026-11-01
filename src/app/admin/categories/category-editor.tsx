"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { saveCategory } from "../actions";

type Row = { id: string; name: string; slug: string; parent_id: string | null; sort_order: number; is_active: boolean; icon: string | null; attributeCount: number; liveCount: number };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CategoryForm({ row, parents, onDone }: { row?: Row; parents: { id: string; name: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [parentId, setParentId] = useState(row?.parent_id ?? "");
  const [sort, setSort] = useState(String(row?.sort_order ?? 0));
  const [active, setActive] = useState(row?.is_active ?? true);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1.4fr_1.2fr_1.2fr_5rem_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveCategory(row?.id ?? null, { name, slug: slug || slugify(name), parentId: parentId || null, sortOrder: sort, isActive: active, icon: row?.icon ?? null });
          if (r.ok) { toast.success(r.message); onDone(); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <Input aria-label="Name" value={name} onChange={(e) => { setName(e.target.value); if (!row) setSlug(slugify(e.target.value)); }} placeholder="Name" className="h-9" required />
      <Input aria-label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="h-9" />
      <Select aria-label="Parent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9">
        <option value="">Top level</option>
        {parents.filter((p) => p.id !== row?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <Input aria-label="Sort order" type="number" min={0} value={sort} onChange={(e) => setSort(e.target.value)} className="h-9" />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--brand)]" /> Active</label>
      <div className="flex gap-1">
        <Button type="submit" size="sm" pending={pending}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function CategoryEditor({ rows, parents }: { rows: Row[]; parents: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        {editing === "new" ? (
          <CategoryForm parents={parents} onDone={() => setEditing(null)} />
        ) : (
          <Button onClick={() => setEditing("new")}>Add category</Button>
        )}
      </Card>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className={cn("p-3", r.parent_id && "pl-8")}>
            {editing === r.id ? (
              <CategoryForm row={r} parents={parents} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-8 text-xs tabular text-ink-faint">{r.sort_order}</span>
                <span className={cn("flex-1 text-sm", !r.parent_id && "font-semibold", !r.is_active && "text-ink-faint line-through")}>{r.name}</span>
                <span className="text-xs text-ink-faint">/{r.slug}</span>
                {r.attributeCount ? <Badge>{r.attributeCount} fields</Badge> : null}
                <Badge tone={r.liveCount ? "success" : "neutral"}>{r.liveCount} live</Badge>
                {!r.is_active ? <Badge tone="danger">Inactive</Badge> : null}
                <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>Edit</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

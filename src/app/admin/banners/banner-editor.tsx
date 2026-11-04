"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BannerView } from "@/components/site-banner-view";
import type { Tables } from "@/lib/supabase/database.types";
import { deleteBanner, saveBanner, type BannerInput } from "../dashboard-actions";

type Row = Tables<"site_banners">;

const local = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const blank: BannerInput = { placement: "home", title: "", body: "", linkUrl: "", linkLabel: "", tone: "brand", startsAt: "", endsAt: "", isActive: true, sortOrder: 0 };

function state(b: Row) {
  const now = Date.now();
  if (!b.is_active) return { label: "Off", tone: "neutral" as const };
  if (new Date(b.starts_at).getTime() > now) return { label: "Scheduled", tone: "brand" as const };
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return { label: "Ended", tone: "neutral" as const };
  return { label: "Live", tone: "success" as const };
}

function Form({ id, initial, onDone }: { id: string | null; initial: BannerInput; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof BannerInput>(k: K, val: BannerInput[K]) => setV({ ...v, [k]: val });

  return (
    <form
      className="grid gap-4 border-t border-line py-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBanner(id, v);
          if (r.ok) { toast.success(r.message); setErrors({}); onDone(); router.refresh(); }
          else { toast.error(r.error); setErrors(r.fieldErrors ?? {}); }
        });
      }}
    >
      <Field id="b-title" label="Headline" required error={errors.title} className="sm:col-span-2">
        <Input id="b-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Free delivery in Accra this weekend" maxLength={80} />
      </Field>
      <Field id="b-body" label="Details" hint="Optional, one short sentence." error={errors.body} className="sm:col-span-2">
        <Input id="b-body" value={v.body} onChange={(e) => set("body", e.target.value)} placeholder="On store orders over GH₵ 300, until Sunday." maxLength={200} />
      </Field>
      <Field id="b-link" label="Link" hint="A page here, like /store, or a full https:// address." error={errors.linkUrl}>
        <Input id="b-link" value={v.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="/store" />
      </Field>
      <Field id="b-label" label="Button text" error={errors.linkLabel}>
        <Input id="b-label" value={v.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} placeholder="Shop now" maxLength={30} />
      </Field>
      <Field id="b-place" label="Where it shows">
        <Select id="b-place" value={v.placement} onChange={(e) => set("placement", e.target.value as BannerInput["placement"])}>
          <option value="home">Home page</option><option value="store">Store page</option>
        </Select>
      </Field>
      <Field id="b-tone" label="Colour">
        <Select id="b-tone" value={v.tone} onChange={(e) => set("tone", e.target.value as BannerInput["tone"])}>
          <option value="brand">Indigo tint</option><option value="gold">Gold tint</option><option value="ink">Dark</option>
        </Select>
      </Field>
      <Field id="b-start" label="Starts" hint="Leave empty to start now. Ghana time." error={errors.startsAt}>
        <Input id="b-start" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
      </Field>
      <Field id="b-end" label="Ends" hint="Leave empty to keep it up until you switch it off." error={errors.endsAt}>
        <Input id="b-end" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
      </Field>
      <Field id="b-sort" label="Sort order" hint="Lower numbers show first.">
        <Input id="b-sort" inputMode="numeric" value={String(v.sortOrder)} onChange={(e) => set("sortOrder", Number(e.target.value.replace(/\D/g, "")) || 0)} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        Switched on
      </label>
      {v.title.trim().length >= 3 ? (
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs text-ink-faint">Preview</p>
          <BannerView banner={{ id: "preview", title: v.title, body: v.body || null, link_url: v.linkUrl || null, link_label: v.linkLabel || null, tone: v.tone }} />
        </div>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" pending={pending}>{id ? "Save banner" : "Create banner"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function BannerEditor({ banners }: { banners: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div>
      {editing === "new" ? <Form id={null} initial={blank} onDone={() => setEditing(null)} /> : (
        <Button onClick={() => setEditing("new")}><Plus size={16} aria-hidden /> New banner</Button>
      )}
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {banners.length === 0 ? <li className="py-10 text-center text-sm text-ink-soft">No banners yet. Create one to announce a sale or delivery offer.</li> : null}
        {banners.map((b) => {
          const s = state(b);
          return (
            <li key={b.id} className="py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="text-xs text-ink-faint">{b.placement === "home" ? "Home page" : "Store page"}</span>
                  </div>
                  <p className="mt-1 font-medium">{b.title}</p>
                  {b.body ? <p className="text-sm text-ink-soft">{b.body}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(editing === b.id ? null : b.id)}>{editing === b.id ? "Close" : "Edit"}</Button>
                  <ConfirmDialog
                    trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>Delete</Button>}
                    title="Delete this banner?"
                    body={`"${b.title}" will disappear from the site. Switch it off instead if you might reuse it.`}
                    confirmLabel="Delete banner"
                    onConfirm={async () => {
                      const r = await deleteBanner(b.id);
                      if (r.ok) { toast.success(r.message); router.refresh(); }
                      return r;
                    }}
                  />
                </div>
              </div>
              {editing === b.id ? (
                <Form id={b.id} onDone={() => setEditing(null)} initial={{
                  placement: b.placement, title: b.title, body: b.body ?? "", linkUrl: b.link_url ?? "", linkLabel: b.link_label ?? "",
                  tone: b.tone, startsAt: local(b.starts_at), endsAt: local(b.ends_at), isActive: b.is_active, sortOrder: b.sort_order,
                }} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { saveBundle } from "../store-actions";

type Row = { id: string | null; network: "mtn" | "telecel" | "airteltigo"; name: string; validity: string; price: string; providerCode: string; sortOrder: string; isActive: boolean };

function BundleRow({ row, onDone }: { row: Row; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(row);
  const [pending, start] = useTransition();
  return (
    <form className="grid items-center gap-2 p-3 sm:grid-cols-[7rem_1.4fr_1fr_6rem_1.2fr_4rem_auto_auto]" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveBundle(row.id, v);
        if (r.ok) { toast.success(r.message); onDone?.(); router.refresh(); } else toast.error(r.error);
      });
    }}>
      <Select aria-label="Network" value={v.network} onChange={(e) => setV({ ...v, network: e.target.value as Row["network"] })} className="h-9">
        <option value="mtn">MTN</option><option value="telecel">Telecel</option><option value="airteltigo">AirtelTigo</option>
      </Select>
      <Input aria-label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. 5 GB" className="h-9" />
      <Input aria-label="Validity" value={v.validity} onChange={(e) => setV({ ...v, validity: e.target.value })} placeholder="e.g. 30 days" className="h-9" />
      <Input aria-label="Price GH₵" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} placeholder="GH₵" inputMode="decimal" className="h-9" />
      <Input aria-label="Hubtel bundle code" value={v.providerCode} onChange={(e) => setV({ ...v, providerCode: e.target.value })} placeholder="Hubtel code" className="h-9 font-mono text-xs" />
      <Input aria-label="Sort" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} inputMode="numeric" className="h-9" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="accent-[var(--brand)]" /> On sale</label>
      <Button type="submit" size="sm" variant="secondary" pending={pending}>Save</Button>
    </form>
  );
}

export function BundleEditor({ bundles }: { bundles: Row[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        {adding ? (
          <BundleRow row={{ id: null, network: "mtn", name: "", validity: "", price: "", providerCode: "", sortOrder: "0", isActive: true }} onDone={() => setAdding(false)} />
        ) : (
          <div className="p-3"><Button onClick={() => setAdding(true)}>Add bundle</Button></div>
        )}
      </Card>
      <Card className="divide-y divide-line">
        {bundles.length === 0 ? <p className="p-4 text-sm text-ink-soft">No bundles yet.</p> : bundles.map((b) => <BundleRow key={b.id} row={b} />)}
      </Card>
    </div>
  );
}

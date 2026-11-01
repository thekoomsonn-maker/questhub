"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Select } from "@/components/ui/field";
import { deleteListing, renewListing, setListingStatus } from "./actions";

type Row = { id: string; slug: string; status: string; expiringSoon: boolean };

export function ListingRowActions({ listing, buyers }: { listing: Row; buyers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const soldRef = useRef<HTMLDialogElement>(null);
  const [buyer, setBuyer] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done.");
      else toast.error(r.error);
      router.refresh();
    });

  const s = listing.status;
  const { expiringSoon } = listing;

  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {s !== "removed" ? <ButtonLink href={`/seller-dashboard/listings/${listing.id}/edit`} variant="secondary" size="sm">Edit</ButtonLink> : null}
      {s === "draft" || s === "rejected" ? (
        <Button size="sm" pending={pending} onClick={() => run(() => setListingStatus(listing.id, "pending_review"))}>Submit</Button>
      ) : null}
      {s === "published" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => setListingStatus(listing.id, "paused"))}>Pause</Button> : null}
      {s === "paused" ? <Button size="sm" pending={pending} onClick={() => run(() => setListingStatus(listing.id, "published"))}>Resume</Button> : null}
      {s === "published" || s === "paused" ? (
        <Button size="sm" variant="secondary" onClick={() => soldRef.current?.showModal()}>Mark sold</Button>
      ) : null}
      {s === "published" ? <Link href={`/seller-dashboard/promotions?listing=${listing.id}`} className="inline-flex h-8 items-center px-2 text-sm font-medium text-brand hover:underline">Promote</Link> : null}
      {s === "expired" || (s === "published" && expiringSoon) ? (
        <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => renewListing(listing.id))}>Renew</Button>
      ) : null}
      {s === "sold" ? <Button size="sm" variant="secondary" pending={pending} onClick={() => run(() => setListingStatus(listing.id, "pending_review"))}>Relist</Button> : null}
      {s === "draft" || s === "rejected" ? (
        <ConfirmDialog
          title="Delete this listing?"
          body="The listing and its photos will be permanently deleted."
          confirmLabel="Delete"
          onConfirm={async () => {
            const r = await deleteListing(listing.id);
            if (r.ok) { toast.success(r.message); router.refresh(); }
            return r;
          }}
          trigger={(open) => <Button size="sm" variant="ghost" className="text-danger" onClick={open}>Delete</Button>}
        />
      ) : null}

      <dialog ref={soldRef} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink backdrop:bg-ink/40">
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            soldRef.current?.close();
            run(() => setListingStatus(listing.id, "sold", buyer || null));
          }}
        >
          <h2 className="font-display text-lg font-semibold">Mark as sold</h2>
          <p className="text-sm text-ink-soft">Buyers who messaged you will see it&apos;s sold. If you sold it to someone through {"QuestHub"}, choose them so they can leave you a review.</p>
          <Field id={`buyer-${listing.id}`} label="Who bought it?">
            <Select id={`buyer-${listing.id}`} value={buyer} onChange={(e) => setBuyer(e.target.value)}>
              <option value="">Sold elsewhere / prefer not to say</option>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => soldRef.current?.close()}>Cancel</Button>
            <Button type="submit">Mark as sold</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

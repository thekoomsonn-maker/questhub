"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, RotateCw, Star, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui/button";
import { site } from "@/config/site";
import { checkImage, prepareImage, readImageSize, uploadToBucket } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { addListingImages, discardUploads, removeListingImage, reorderListingImages } from "./actions";

const MAX = 10;

export type ManagedImage = {
  key: string;
  id?: string;
  url: string;
  state: "processing" | "uploading" | "done" | "failed";
  error?: string;
  file?: File;
};

/**
 * Photo uploads: each file is checked, re-encoded (strips EXIF/GPS), uploaded
 * straight to storage under the seller's folder, then recorded on the listing.
 * Failed uploads keep their file so the seller can retry.
 */
export function PhotoManager({
  userId,
  listingId,
  images,
  onChange,
}: {
  userId: string;
  listingId: string;
  images: ManagedImage[];
  onChange: (update: (prev: ManagedImage[]) => ManagedImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const done = images.filter((i) => i.state === "done");
  const busy = images.some((i) => i.state === "processing" || i.state === "uploading");

  const patch = (key: string, p: Partial<ManagedImage>) => onChange((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function uploadOne(item: ManagedImage) {
    const file = item.file!;
    let path: string | null = null;
    try {
      patch(item.key, { state: "processing", error: undefined });
      await readImageSize(file); // throws if it isn't a real image
      const blob = await prepareImage(file);
      const { width, height } = await readImageSize(new File([blob], "x.webp", { type: "image/webp" }));
      patch(item.key, { state: "uploading" });
      path = await uploadToBucket("listing-images", `${userId}/${listingId}/${crypto.randomUUID()}.webp`, blob);
      const r = await addListingImages(listingId, [{ path, width, height }]);
      if (!r.ok || !r.data) throw new Error(r.ok ? "Upload failed." : r.error);
      patch(item.key, { state: "done", id: r.data[0].id, file: undefined });
    } catch (e) {
      if (path) await discardUploads([path]);
      const message = e instanceof Error && e.message ? e.message : "Upload failed.";
      patch(item.key, { state: "failed", error: /decode|source image/i.test(message) ? "This file isn't a readable image." : message });
    }
  }

  function addFiles(files: FileList | File[]) {
    const room = MAX - images.filter((i) => i.state !== "failed").length;
    const list = Array.from(files);
    if (list.length > room) toast.error(`You can add ${room} more photo${room === 1 ? "" : "s"} (maximum ${MAX}).`);
    const accepted: ManagedImage[] = [];
    for (const file of list.slice(0, Math.max(0, room))) {
      const check = checkImage(file);
      if (!check.ok) {
        toast.error(check.error);
        continue;
      }
      accepted.push({ key: crypto.randomUUID(), url: URL.createObjectURL(file), state: "processing", file });
    }
    if (!accepted.length) return;
    onChange((prev) => [...prev, ...accepted]);
    // Upload sequentially to be gentle on mobile connections.
    void (async () => {
      for (const item of accepted) await uploadOne(item);
    })();
  }

  async function remove(item: ManagedImage) {
    if (item.id) {
      const r = await removeListingImage(item.id);
      if (!r.ok) return toast.error(r.error);
    }
    onChange((prev) => prev.filter((i) => i.key !== item.key));
  }

  async function move(item: ManagedImage, to: number) {
    const order = done.filter((i) => i.key !== item.key);
    order.splice(to, 0, item);
    onChange((prev) => [...order, ...prev.filter((i) => i.state !== "done")]);
    const r = await reorderListingImages(listingId, order.map((i) => i.id!));
    if (!r.ok) toast.error(r.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-4 py-8 text-center", dragging ? "border-brand bg-brand-tint" : "border-line-strong")}
      >
        <ImagePlus size={28} className="text-brand" aria-hidden />
        <p className="text-sm font-medium">Add up to {MAX} photos</p>
        <p className="text-xs text-ink-faint">JPG, PNG or WebP, up to {site.limits.maxImageBytes / 1024 / 1024} MB each. Location data is removed from photos.</p>
        <input ref={inputRef} type="file" multiple accept={site.limits.imageTypes.join(",")} className="sr-only" id="photos" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={images.length >= MAX}>Choose photos</Button>
      </div>

      <p className="text-sm text-ink-soft" aria-live="polite">
        {busy
          ? `Uploading… ${done.length} of ${images.length} ready`
          : done.length
            ? `${done.length} photo${done.length === 1 ? "" : "s"} added. The first one is the cover.`
            : "No photos yet."}
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((item) => {
          const position = done.indexOf(item);
          return (
            <li key={item.key} className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className={cn("aspect-[4/3] w-full object-cover", item.state !== "done" && "opacity-50")} />
              {position === 0 ? <span className="absolute left-2 top-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">Cover</span> : null}
              {item.state === "processing" || item.state === "uploading" ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-medium text-ink"><Spinner />{item.state === "processing" ? "Preparing" : "Uploading"}</div>
              ) : null}
              {item.state === "failed" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/90 p-2 text-center">
                  <p className="flex items-center gap-1 text-xs font-medium text-danger"><TriangleAlert size={14} aria-hidden />{item.error}</p>
                  <div className="flex gap-1">
                    {item.file ? <Button type="button" size="sm" variant="secondary" onClick={() => uploadOne(item)}><RotateCw size={14} aria-hidden /> Retry</Button> : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => remove(item)}>Remove</Button>
                  </div>
                </div>
              ) : null}
              {item.state === "done" ? (
                <div className="flex items-center justify-between border-t border-line bg-surface px-1 py-1">
                  <div className="flex">
                    <button type="button" aria-label="Move earlier" disabled={position <= 0} onClick={() => move(item, position - 1)} className="rounded p-1.5 hover:bg-paper disabled:opacity-30"><ArrowLeft size={16} /></button>
                    <button type="button" aria-label="Move later" disabled={position >= done.length - 1} onClick={() => move(item, position + 1)} className="rounded p-1.5 hover:bg-paper disabled:opacity-30"><ArrowRight size={16} /></button>
                    {position > 0 ? <button type="button" aria-label="Make cover photo" onClick={() => move(item, 0)} className="rounded p-1.5 hover:bg-paper"><Star size={16} /></button> : null}
                  </div>
                  <button type="button" aria-label="Delete photo" onClick={() => remove(item)} className="rounded p-1.5 text-danger hover:bg-danger-tint"><Trash2 size={16} /></button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

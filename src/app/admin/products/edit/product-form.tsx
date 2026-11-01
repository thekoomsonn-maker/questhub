"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { checkImage, prepareImage } from "@/lib/upload";
import { addProductImage, removeProductImage, saveProduct, type ProductInput } from "../../store-actions";

type Values = Omit<ProductInput, "categoryId" | "price" | "compareAtPrice" | "stock"> & { categoryId: string | null; price: string; compareAtPrice: string; stock: string };

export function ProductForm({ product, categories }: {
  product: { id: string; slug: string; values: Values; images: { id: string; url: string }[] } | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(product?.values ?? { name: "", brand: "", description: "", categoryId: null, price: "", compareAtPrice: "", stock: "0", sku: "", warranty: "", isActive: true, isFeatured: false });
  const [images, setImages] = useState(product?.images ?? []);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  async function upload(files: FileList) {
    if (!product) return;
    setUploading(true);
    for (const file of Array.from(files).slice(0, 8)) {
      const check = checkImage(file);
      if (!check.ok) { toast.error(check.error); continue; }
      try {
        const blob = await prepareImage(file, 1400);
        const path = `products/${product.id}/${crypto.randomUUID()}.webp`;
        const { error } = await createClient().storage.from("product-images").upload(path, blob, { contentType: "image/webp" });
        if (error) throw new Error(error.message);
        const r = await addProductImage(product.id, path);
        if (!r.ok) throw new Error(r.error);
        setImages((s) => [...s, { id: r.data!.id, url: URL.createObjectURL(blob) }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    setUploading(false);
  }

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[1fr_320px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveProduct(product?.id ?? null, v);
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.message);
            if (!product) router.push(`/admin/products/edit?id=${r.data!.id}`);
            else router.refresh();
          });
        }}
      >
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field id="p-name" label="Name" required className="sm:col-span-2"><Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Galaxy A15, 128 GB, black" /></Field>
          <Field id="p-brand" label="Brand"><Input id="p-brand" value={v.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field id="p-cat" label="Category">
            <Select id="p-cat" value={v.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field id="p-desc" label="Description" required className="sm:col-span-2"><Textarea id="p-desc" rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
        </Card>
        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <Field id="p-price" label="Price (GH₵)" required><Input id="p-price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field id="p-compare" label="Was (GH₵)" hint="Shows a discount"><Input id="p-compare" inputMode="decimal" value={v.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} /></Field>
          <Field id="p-stock" label="In stock" required><Input id="p-stock" inputMode="numeric" value={v.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field id="p-sku" label="SKU"><Input id="p-sku" value={v.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field id="p-warranty" label="Warranty" className="sm:col-span-2"><Input id="p-warranty" value={v.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="e.g. 12 months manufacturer warranty" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-[var(--brand)]" /> On sale</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="accent-[var(--brand)]" /> Featured</label>
        </Card>
        <div className="flex gap-2">
          <Button type="submit" size="lg" pending={pending}>{product ? "Save product" : "Create product"}</Button>
          {product ? <Link href={`/store/${product.slug}`} target="_blank" className="inline-flex items-center px-3 text-sm text-brand hover:underline">View in store</Link> : null}
        </div>
      </form>
      <Card className="h-fit p-5">
        <h2 className="text-sm font-semibold">Photos</h2>
        {!product ? <p className="mt-2 text-sm text-ink-soft">Create the product first, then add photos.</p> : (
          <>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <li key={img.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="aspect-square w-full rounded-[6px] border border-line bg-white object-contain" />
                  {i === 0 ? <span className="absolute left-1 top-1 rounded bg-ink/80 px-1 text-[10px] text-white">Cover</span> : null}
                  <button type="button" aria-label="Delete photo" className="absolute right-1 top-1 rounded bg-surface/90 p-1 text-danger"
                    onClick={async () => { const r = await removeProductImage(img.id); if (r.ok) setImages((s) => s.filter((x) => x.id !== img.id)); else toast.error(r.error); }}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" id="p-photos" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
            <Button type="button" variant="secondary" className="mt-3 w-full" pending={uploading} onClick={() => fileRef.current?.click()}><ImagePlus size={16} aria-hidden /> Add photos</Button>
            <p className="mt-2 text-xs text-ink-faint">Square photos on a plain background look best.</p>
          </>
        )}
      </Card>
    </div>
  );
}

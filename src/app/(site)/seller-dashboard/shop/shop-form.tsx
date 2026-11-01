"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { site } from "@/config/site";
import { checkImage, prepareImage, uploadToBucket } from "@/lib/upload";
import type { Region } from "@/lib/data/catalog";
import { saveShop, setShopImage, type ShopInput } from "./actions";

type Values = Omit<ShopInput, "regionId"> & { regionId: string };

export function ShopForm({ userId, regions, exists, images, initial }: {
  userId: string; regions: Region[]; exists: boolean; images: { logo: string | null; banner: string | null }; initial: Values;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [logo, setLogo] = useState(images.logo);
  const [banner, setBanner] = useState(images.banner);
  const [uploading, setUploading] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (k: string) => errors[k]?.[0];

  async function upload(kind: "logo" | "banner", file: File) {
    const check = checkImage(file);
    if (!check.ok) return void toast.error(check.error);
    setUploading(kind);
    try {
      const blob = await prepareImage(file, kind === "logo" ? 512 : 1600);
      const path = await uploadToBucket("avatars", `${userId}/shop-${kind}-${crypto.randomUUID()}.webp`, blob);
      const r = await setShopImage(kind, path);
      if (!r.ok) throw new Error(r.error);
      (kind === "logo" ? setLogo : setBanner)(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {exists ? (
        <Card className="overflow-hidden">
          <div className="relative h-36 bg-brand-tint sm:h-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : null}
            <input ref={bannerRef} type="file" accept={site.limits.imageTypes.join(",")} className="sr-only" id="banner" onChange={(e) => { if (e.target.files?.[0]) void upload("banner", e.target.files[0]); e.target.value = ""; }} />
            <Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3" pending={uploading === "banner"} onClick={() => bannerRef.current?.click()}>
              <ImagePlus size={14} aria-hidden /> {banner ? "Change banner" : "Add banner"}
            </Button>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="h-16 w-16 overflow-hidden rounded-[12px] border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <input ref={logoRef} type="file" accept={site.limits.imageTypes.join(",")} className="sr-only" id="logo" onChange={(e) => { if (e.target.files?.[0]) void upload("logo", e.target.files[0]); e.target.value = ""; }} />
            <Button type="button" size="sm" variant="secondary" pending={uploading === "logo"} onClick={() => logoRef.current?.click()}>{logo ? "Change logo" : "Add logo"}</Button>
            <p className="text-xs text-ink-faint">Square logo, and a wide banner (about 3:1).</p>
          </div>
        </Card>
      ) : null}

      <form className="flex flex-col gap-4" noValidate onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveShop(v);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.error);
            return;
          }
          setErrors({});
          setFormError(null);
          toast.success(r.message);
          router.refresh();
        });
      }}>
        {formError ? <FormMessage>{formError}</FormMessage> : null}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">About your shop</h2>
          <Field id="s-name" label="Shop name" required error={err("name")}><Input id="s-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={60} /></Field>
          <Field id="s-slug" label="Shop address" required hint={`${site.url.replace(/^https?:\/\//, "")}/shop/${v.slug || "your-shop"}`} error={err("slug")}>
            <Input id="s-slug" value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={50} />
          </Field>
          <Field id="s-tagline" label="Tagline" hint="One line, e.g. “Handmade kente accessories from Bonwire”" className="sm:col-span-2"><Input id="s-tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} /></Field>
          <Field id="s-about" label="About" className="sm:col-span-2"><Textarea id="s-about" value={v.about} onChange={(e) => set("about", e.target.value)} maxLength={2000} rows={4} /></Field>
        </Card>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">Location and contact</h2>
          <Field id="s-region" label="Region" required error={err("regionId")}>
            <Select id="s-region" value={v.regionId} onChange={(e) => set("regionId", e.target.value)}>
              <option value="">Choose a region</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field id="s-city" label="Town or area" required error={err("city")}><Input id="s-city" value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={80} /></Field>
          <Field id="s-address" label="Shop address (optional)" hint="Shown publicly. Leave empty if you only deliver." className="sm:col-span-2"><Input id="s-address" value={v.address} onChange={(e) => set("address", e.target.value)} maxLength={200} /></Field>
          <Field id="s-phone" label="Shop phone" error={err("phone")}><Input id="s-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field id="s-whatsapp" label="WhatsApp" error={err("whatsapp")}><Input id="s-whatsapp" type="tel" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          <Field id="s-hours" label="Opening hours" hint="e.g. Mon–Sat 8am–7pm" className="sm:col-span-2"><Input id="s-hours" value={v.openingHours} onChange={(e) => set("openingHours", e.target.value)} maxLength={300} /></Field>
        </Card>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-display text-lg font-semibold">Online orders</h2>
            <p className="text-sm text-ink-soft">Buyers pay you directly. QuestHub doesn&apos;t take or hold the money.</p>
          </div>
          <Field id="s-delivery" label="Delivery and pickup" hint="Areas you deliver to, fees, delivery times, or pickup details." className="sm:col-span-2"><Textarea id="s-delivery" value={v.deliveryInfo} onChange={(e) => set("deliveryInfo", e.target.value)} maxLength={500} rows={3} /></Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.acceptsPayOnDelivery} onChange={(e) => set("acceptsPayOnDelivery", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" /> Pay on delivery or pickup (cash or MoMo at the door)</label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.acceptsMomo} onChange={(e) => set("acceptsMomo", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" /> Mobile Money to my number before delivery</label>
          {err("acceptsPayOnDelivery") ? <p role="alert" className="text-xs text-danger sm:col-span-2">{err("acceptsPayOnDelivery")}</p> : null}
          {v.acceptsMomo ? (
            <>
              <Field id="s-momo" label="MoMo number" required error={err("momoNumber")}><Input id="s-momo" type="tel" value={v.momoNumber} onChange={(e) => set("momoNumber", e.target.value)} /></Field>
              <Field id="s-momo-name" label="Name on the MoMo account" required hint="Buyers check this before sending money."><Input id="s-momo-name" value={v.momoName} onChange={(e) => set("momoName", e.target.value)} maxLength={80} /></Field>
            </>
          ) : null}
        </Card>
        <div><Button type="submit" size="lg" pending={pending}>{exists ? "Save shop" : "Create shop"}</Button></div>
      </form>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { CategoryIcon } from "@/components/listings/category-icon";
import { Price } from "@/components/listings/listing-card";
import { conditionLabel, statusLabel } from "@/lib/format";
import { listingSchema, type ListingInput } from "@/lib/validation";
import type { AttributeDef } from "@/lib/listing-attributes";
import type { CategoryNode, Region } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { saveListing, setListingStatus } from "./actions";
import { PhotoManager, type ManagedImage } from "./photo-manager";

type Attr = AttributeDef & { category_id: string; sort_order: number };

const STEPS = ["Category", "Details", "Title & description", "Price & condition", "Location", "Photos", "Preview", "Publish"] as const;

const STEP_FIELDS: Record<number, FieldPath<ListingInput>[]> = {
  0: ["categoryId"],
  2: ["title", "description"],
  3: ["price", "condition", "quantity", "isNegotiable"],
  4: ["regionId", "city"],
};

export type WizardInitial = {
  id: string;
  slug: string;
  status: string;
  moderationNote: string | null;
  values: ListingInput;
  images: ManagedImage[];
};

export function ListingWizard({
  userId,
  categories,
  regions,
  attributes,
  initial,
  shopActive = false,
}: {
  shopActive?: boolean;
  userId: string;
  categories: CategoryNode[];
  regions: Region[];
  attributes: Attr[];
  initial?: WizardInitial;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initial ? 1 : 0);
  const [listing, setListing] = useState(initial ? { id: initial.id, slug: initial.slug, status: initial.status } : null);
  const [images, setImages] = useState<ManagedImage[]>(initial?.images ?? []);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const form = useForm<ListingInput>({
    resolver: zodResolver(listingSchema),
    mode: "onTouched",
    defaultValues: initial?.values ?? {
      categoryId: "",
      title: "",
      description: "",
      price: "",
      isNegotiable: false,
      condition: "used",
      quantity: 1,
      regionId: "" as unknown as number,
      city: "",
      attributes: {},
    },
  });
  const { register, watch, setValue, trigger, getValues, setError, formState } = form;
  const errors = formState.errors;
  const categoryId = watch("categoryId");

  const allCats = useMemo(() => categories.flatMap((c) => [c, ...c.children.map((s) => ({ ...s, parentName: c.name }))]), [categories]);
  const selected = allCats.find((c) => c.id === categoryId) as (CategoryNode & { parentName?: string }) | undefined;
  const parentId = selected?.parent_id ?? null;
  const [browseParent, setBrowseParent] = useState<string | null>(parentId);
  const attrs = useMemo(
    () => attributes.filter((a) => a.category_id === categoryId || a.category_id === parentId).sort((a, b) => a.sort_order - b.sort_order),
    [attributes, categoryId, parentId],
  );

  async function validateAttributes() {
    const values = getValues("attributes") ?? {};
    let ok = true;
    for (const a of attrs) {
      const v = values[a.key];
      if (a.is_required && (v === undefined || v === null || v === "")) {
        setError(`attributes.${a.key}` as FieldPath<ListingInput>, { message: `${a.label} is required` });
        ok = false;
      }
      if (a.type === "number" && v !== "" && v !== undefined && v !== null && !Number.isFinite(Number(v))) {
        setError(`attributes.${a.key}` as FieldPath<ListingInput>, { message: `${a.label} must be a number` });
        ok = false;
      }
    }
    return ok;
  }

  async function persist(): Promise<boolean> {
    setServerError(null);
    const r = await saveListing(listing?.id ?? null, getValues());
    if (!r.ok) {
      setServerError(r.error);
      for (const [k, msgs] of Object.entries(r.fieldErrors ?? {})) {
        const name = (k.startsWith("attr.") ? `attributes.${k.slice(5)}` : k) as FieldPath<ListingInput>;
        if (msgs?.[0]) setError(name, { message: msgs[0] });
      }
      return false;
    }
    if (!listing) {
      // Stay on this URL: changing it would remount the wizard mid-flow.
      // The draft is listed on the dashboard if the seller leaves now.
      setListing({ id: r.data!.id, slug: r.data!.slug, status: "draft" });
    }
    return true;
  }

  function next() {
    start(async () => {
      if (STEP_FIELDS[step] && !(await trigger(STEP_FIELDS[step]))) return;
      if (step === 1 && !(await validateAttributes())) return;
      // Entering Photos: the listing must exist so photos have somewhere to go.
      if (step === 4 && !(await persist())) return;
      if (step === 5 && images.filter((i) => i.state === "done").length === 0) {
        setServerError("Add at least one photo. Listings with photos get far more replies.");
        return;
      }
      setServerError(null);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function finish(action: "draft" | "submit") {
    start(async () => {
      if (!(await trigger()) || !(await validateAttributes())) {
        setServerError("Some details are missing. Go back and fill in the highlighted fields.");
        return;
      }
      if (!(await persist())) return;
      if (!listing && action === "submit") return;
      const id = listing?.id;
      if (!id) return;
      const current = listing.status;
      let target: "draft" | "pending_review" | "published" | null = null;
      if (action === "submit") {
        target = current === "published" || current === "paused" ? null : "pending_review";
      } else if (current === "pending_review") {
        target = "draft";
      }
      if (target) {
        const r = await setListingStatus(id, target);
        if (!r.ok) {
          setServerError(r.error);
          return;
        }
        toast.success(r.message);
      } else {
        toast.success(current === "published" ? "Changes saved." : "Draft saved.");
      }
      router.push("/seller-dashboard/listings");
      router.refresh();
    });
  }

  const v = watch();
  const isLive = listing?.status === "published" || listing?.status === "paused";
  const err = (name: string) => {
    const parts = name.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = errors;
    for (const p of parts) e = e?.[p];
    return e?.message as string | undefined;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Steps">
        {STEPS.map((label, i) => {
          const reachable = i <= step || (listing && i <= 6 && i !== 5) || (listing && i === 5);
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                disabled={!reachable || pending || (i > 4 && !listing)}
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[var(--radius-field)] px-3 py-2 text-left text-sm disabled:opacity-40",
                  i === step ? "bg-brand text-white" : "text-ink-soft hover:bg-brand-tint",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular", i === step ? "bg-white text-brand" : i < step ? "bg-success text-white" : "bg-line text-ink-soft")}>
                  {i < step ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">{STEPS[step]}</h2>
          {initial?.moderationNote && step === 1 ? (
            <div className="mt-3"><FormMessage tone="info">Moderator note: {initial.moderationNote}</FormMessage></div>
          ) : null}
          {serverError ? <div className="mt-3"><FormMessage>{serverError}</FormMessage></div> : null}

          <div className="mt-5">
            {step === 0 ? (
              <div className="flex flex-col gap-4">
                {!browseParent ? (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {categories.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setBrowseParent(c.id)} className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-line p-3 text-left text-sm font-medium hover:border-brand">
                          <CategoryIcon name={c.icon} size={20} className="text-brand" />{c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <button type="button" onClick={() => setBrowseParent(null)} className="flex items-center gap-1 self-start text-sm text-brand hover:underline">
                      <ChevronLeft size={16} aria-hidden /> All categories
                    </button>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">{categories.find((c) => c.id === browseParent)?.name}: choose a subcategory</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {categories.find((c) => c.id === browseParent)?.children.map((s) => (
                          <label key={s.id} className={cn("flex cursor-pointer items-center gap-2 rounded-[var(--radius-field)] border p-3 text-sm", categoryId === s.id ? "border-brand bg-brand-tint" : "border-line hover:border-line-strong")}>
                            <input type="radio" value={s.id} checked={categoryId === s.id} onChange={() => setValue("categoryId", s.id, { shouldValidate: true })} className="accent-[var(--brand)]" />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
                {err("categoryId") ? <p role="alert" className="text-sm text-danger">{err("categoryId")}</p> : null}
              </div>
            ) : null}

            {step === 1 ? (
              attrs.length === 0 ? (
                <p className="text-sm text-ink-soft">No extra details needed for {selected?.name}. Continue to the next step.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {attrs.map((a) => {
                    const id = `attr-${a.key}`;
                    const name = `attributes.${a.key}` as FieldPath<ListingInput>;
                    const label = `${a.label}${a.unit ? ` (${a.unit})` : ""}`;
                    if (a.type === "boolean") {
                      return (
                        <label key={a.id} className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input type="checkbox" {...register(name)} className="h-4 w-4 accent-[var(--brand)]" /> {a.label}
                        </label>
                      );
                    }
                    return (
                      <Field key={a.id} id={id} label={label} required={a.is_required} error={err(name)}>
                        {a.type === "select" ? (
                          <Select id={id} {...register(name)} aria-invalid={Boolean(err(name))}>
                            <option value="">Choose…</option>
                            {(a.options as string[]).map((o) => <option key={o} value={o}>{o}</option>)}
                          </Select>
                        ) : (
                          <Input id={id} {...register(name)} inputMode={a.type === "number" ? "numeric" : undefined} aria-invalid={Boolean(err(name))} maxLength={200} />
                        )}
                      </Field>
                    );
                  })}
                </div>
              )
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-4">
                <Field id="title" label="Title" required hint="Say exactly what it is, e.g. “iPhone 13, 128 GB, blue”." error={err("title")}>
                  <Input id="title" {...register("title")} maxLength={100} aria-invalid={Boolean(err("title"))} />
                </Field>
                <Field id="description" label="Description" required hint="Condition, what's included, reason for selling, delivery options." error={err("description")}>
                  <Textarea id="description" {...register("description")} rows={8} maxLength={5000} aria-invalid={Boolean(err("description"))} />
                </Field>
                <p className="text-right text-xs text-ink-faint tabular">{(v.description ?? "").length} / 5,000</p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="price" label="Price (GH₵)" hint="Leave empty to show “Contact for price”." error={err("price")}>
                  <Input id="price" {...register("price")} inputMode="decimal" placeholder="e.g. 2500" aria-invalid={Boolean(err("price"))} />
                </Field>
                <Field id="condition" label="Condition" required error={err("condition")}>
                  <Select id="condition" {...register("condition")}>
                    <option value="new">Brand new</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="not_applicable">Not applicable (services, jobs)</option>
                  </Select>
                </Field>
                <Field id="quantity" label="Quantity available" error={err("quantity")}>
                  <Input id="quantity" type="number" min={1} {...register("quantity")} />
                </Field>
                <label className="flex items-center gap-2 self-end pb-3 text-sm">
                  <input type="checkbox" {...register("isNegotiable")} className="h-4 w-4 accent-[var(--brand)]" /> Price is negotiable
                </label>
                {shopActive ? (
                  <label className="flex items-start gap-2 rounded-[var(--radius-field)] border border-line bg-paper p-3 text-sm sm:col-span-2">
                    <input type="checkbox" {...register("orderable")} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                    <span><span className="font-medium">Let buyers order this online from my shop</span><span className="block text-xs text-ink-soft">Buyers add it to their cart and pay you directly. Quantity above is your stock; it goes down as orders come in. Needs a price.</span></span>
                  </label>
                ) : (
                  <p className="text-xs text-ink-faint sm:col-span-2">Want buyers to order online? <a href="/seller-dashboard/shop" className="text-brand underline">Open a shop</a>.</p>
                )}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="regionId" label="Region" required error={err("regionId")}>
                  <Select id="regionId" {...register("regionId")} aria-invalid={Boolean(err("regionId"))}>
                    <option value="">Choose a region</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </Field>
                <Field id="city" label="Town or area" required hint="Shown publicly. Don't include your house number." error={err("city")}>
                  <Input id="city" {...register("city")} placeholder="e.g. Madina" maxLength={80} aria-invalid={Boolean(err("city"))} />
                </Field>
                <p className="text-sm text-ink-soft sm:col-span-2">Next, we&apos;ll save a draft so you can add photos. Only you can see drafts.</p>
              </div>
            ) : null}

            {step === 5 && listing ? (
              <PhotoManager userId={userId} listingId={listing.id} images={images} onChange={setImages} />
            ) : null}

            {step === 6 ? (
              <div className="grid gap-5 sm:grid-cols-[1fr_1.2fr]">
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
                  {images.find((i) => i.state === "done") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images.find((i) => i.state === "done")!.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <Price value={v.price === "" ? null : Number(v.price)} negotiable={v.isNegotiable} size="lg" />
                  <h3 className="mt-1 text-lg font-semibold">{v.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    {[selected?.name, conditionLabel[v.condition as string], [v.city, regions.find((r) => r.id === Number(v.regionId))?.name].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {attrs.filter((a) => v.attributes?.[a.key] !== undefined && v.attributes?.[a.key] !== "").map((a) => (
                      <div key={a.id}><dt className="text-ink-faint">{a.label}</dt><dd className="font-medium">{String(v.attributes[a.key] === true ? "Yes" : v.attributes[a.key] === false ? "No" : v.attributes[a.key])}</dd></div>
                    ))}
                  </dl>
                  <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm">{v.description}</p>
                  <p className="mt-2 text-xs text-ink-faint">{images.filter((i) => i.state === "done").length} photos</p>
                </div>
              </div>
            ) : null}

            {step === 7 ? (
              <div className="flex flex-col gap-4 text-sm">
                {isLive ? (
                  <p>This listing is {statusLabel[listing!.status].toLowerCase()}. If you changed the title, description or category it goes back to review before buyers see the changes; price and photo changes apply straight away.</p>
                ) : (
                  <p>Submit your listing and our moderators will check it, usually within a few hours. You&apos;ll get a notification when it&apos;s live. Or save it as a draft and finish later.</p>
                )}
                <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                  <li>No prohibited items (weapons, drugs, counterfeit goods, wildlife products).</li>
                  <li>Photos must be of the actual item.</li>
                  <li>One listing per item. Duplicates are removed.</li>
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
            <Button type="button" variant="secondary" disabled={step === 0 || pending} onClick={() => { setServerError(null); setStep((s) => s - 1); }}>
              <ChevronLeft size={16} aria-hidden /> Back
            </Button>
            {step < 7 ? (
              <Button type="submit" pending={pending}>
                {step === 4 && !listing ? "Save draft and add photos" : "Continue"} <ChevronRight size={16} aria-hidden />
              </Button>
            ) : (
              <div className="flex gap-2">
                {!isLive ? <Button type="button" variant="secondary" pending={pending} onClick={() => finish("draft")}>Save as draft</Button> : null}
                <Button type="button" pending={pending} onClick={() => finish("submit")}>
                  {isLive ? "Save changes" : "Submit for review"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listingImageUrl } from "@/lib/images";
import { attributeRowsToInput, type AttributeDef } from "@/lib/listing-attributes";
import { statusLabel } from "@/lib/format";
import { FormMessage } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/misc";
import { ListingWizard } from "../../listing-wizard";
import { getWizardData } from "../../../wizard-data";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/seller-dashboard/listings/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await requireSeller(`/seller-dashboard/listings/${id}/edit`);
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*, images:listing_images(id,storage_path,sort_order), values:listing_attribute_values(attribute_id,value_text,value_number,value_bool)")
    .eq("id", id)
    .eq("seller_id", viewer.id)
    .maybeSingle();
  if (!listing) notFound();

  const data = await getWizardData();
  const cat = data.categories.flatMap((c) => [c, ...c.children]).find((c) => c.id === listing.category_id);
  const defs = data.attributes.filter((a) => a.category_id === listing.category_id || a.category_id === cat?.parent_id) as AttributeDef[];

  if (listing.status === "removed") {
    return (
      <>
        <PageHeader title="Edit listing" />
        <FormMessage>This listing was removed by moderators{listing.moderation_note ? `: ${listing.moderation_note}` : ""}. It can&apos;t be edited.</FormMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit listing" description={`Status: ${statusLabel[listing.status]}`} />
      <ListingWizard
        userId={viewer.id}
        {...data}
        initial={{
          id: listing.id,
          slug: listing.slug,
          status: listing.status,
          moderationNote: listing.moderation_note,
          values: {
            categoryId: listing.category_id,
            title: listing.title,
            description: listing.description,
            price: listing.price === null ? "" : String(listing.price),
            isNegotiable: listing.is_negotiable,
            condition: listing.condition,
            quantity: listing.quantity,
            regionId: listing.region_id ?? ("" as unknown as number),
            city: listing.city ?? "",
            attributes: attributeRowsToInput(defs, listing.values),
          },
          images: [...listing.images]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => ({ key: i.id, id: i.id, url: listingImageUrl(i.storage_path)!, state: "done" as const })),
        }}
      />
    </>
  );
}

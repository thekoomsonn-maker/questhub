import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { ListingWizard } from "../listing-wizard";
import { getWizardData } from "../../wizard-data";
import { getMyShop } from "@/lib/data/shops";

export const metadata: Metadata = { title: "Post an ad" };

export default async function NewListingPage() {
  const viewer = await requireSeller("/seller-dashboard/listings/new");
  const [data, shop] = await Promise.all([getWizardData(), getMyShop(viewer.id)]);
  return (
    <>
      <PageHeader title="Post an ad" description="Your progress is saved as a draft once you reach the photos step." />
      <ListingWizard userId={viewer.id} {...data} shopActive={shop?.status === "active"} />
    </>
  );
}

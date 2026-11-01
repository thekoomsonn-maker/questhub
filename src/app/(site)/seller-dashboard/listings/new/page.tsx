import type { Metadata } from "next";
import { requireSeller } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { ListingWizard } from "../listing-wizard";
import { getWizardData } from "../../wizard-data";

export const metadata: Metadata = { title: "Post an ad" };

export default async function NewListingPage() {
  const viewer = await requireSeller("/seller-dashboard/listings/new");
  const data = await getWizardData();
  return (
    <>
      <PageHeader title="Post an ad" description="Your progress is saved as a draft once you reach the photos step." />
      <ListingWizard userId={viewer.id} {...data} />
    </>
  );
}

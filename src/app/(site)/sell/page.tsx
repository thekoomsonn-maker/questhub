import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Camera, MessageCircle, ShieldCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { becomeSeller } from "../account/actions";

export const metadata: Metadata = { title: "Sell on QuestHub" };

export default async function SellPage() {
  const viewer = await requireViewer("/sell");
  if (viewer.profile.role !== "buyer" && viewer.profile.status === "active") redirect("/seller-dashboard/listings/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Start selling on QuestHub</h1>
      <p className="mt-2 text-ink-soft">Posting is free. Switch on selling for your account and you can post your first ad straight away.</p>
      {viewer.profile.status !== "active" ? (
        <div className="mt-6"><FormMessage>Your account is suspended, so you can&apos;t post ads right now.</FormMessage></div>
      ) : (
        <>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-3"><Camera className="mt-0.5 shrink-0 text-brand" aria-hidden /><div><p className="font-medium">Take clear photos</p><p className="text-sm text-ink-soft">Good light, several angles, and the actual item rather than pictures from the internet.</p></div></li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-brand" aria-hidden /><div><p className="font-medium">We check every ad</p><p className="text-sm text-ink-soft">New listings are reviewed before they go live, which keeps scams out and buyers trusting what they see.</p></div></li>
            <li className="flex gap-3"><MessageCircle className="mt-0.5 shrink-0 text-brand" aria-hidden /><div><p className="font-medium">Buyers message you here</p><p className="text-sm text-ink-soft">Your number stays private unless you choose to show it.</p></div></li>
          </ul>
          <form action={becomeSeller} className="mt-8">
            <Button type="submit" size="lg">Start selling</Button>
          </form>
        </>
      )}
    </div>
  );
}

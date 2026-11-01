"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { startCheckout } from "@/lib/payments/service";
import { topupsMode } from "@/lib/payments/config";
import { normaliseGhanaNumber } from "@/lib/networks";
import { friendlyError, type ActionResult } from "@/lib/utils";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("airtime"), network: z.enum(["mtn", "telecel", "airteltigo"]), recipient: z.string(), amount: z.coerce.number().positive("Enter an amount") }),
  z.object({ type: z.literal("data"), network: z.enum(["mtn", "telecel", "airteltigo"]), recipient: z.string(), bundleId: z.uuid("Choose a bundle") }),
]);

export async function buyTopup(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/airtime");
  if (topupsMode() === "off") return { ok: false, error: "Airtime and data aren't available yet. Please check back soon." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const recipient = normaliseGhanaNumber(parsed.data.recipient);
  if (!recipient) return { ok: false, error: "Enter a 10-digit Ghana number, e.g. 024 123 4567." };

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("place_topup_order", {
    p_network: parsed.data.network,
    p_type: parsed.data.type,
    p_recipient: recipient,
    p_amount: parsed.data.type === "airtime" ? parsed.data.amount : 0,
    p_bundle: parsed.data.type === "data" ? parsed.data.bundleId : undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) };

  let url: string;
  try {
    url = (await startCheckout(orderId, viewer.id, viewer.email, form.get("method") === "crypto" ? "crypto" : "mobile_money_card")).url;
  } catch {
    redirect(`/orders/${orderId}?payment=unavailable`);
  }
  redirect(url);
}

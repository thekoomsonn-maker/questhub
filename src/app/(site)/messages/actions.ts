"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { messageSchema } from "@/lib/validation";
import { friendlyError, type ActionResult } from "@/lib/utils";

export type ChatMessage = { id: string; sender_id: string | null; kind: string; body: string; created_at: string };

export async function sendMessage(conversationId: string, body: string): Promise<ActionResult<ChatMessage>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = messageSchema.safeParse({ conversationId, body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a message." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: parsed.data.conversationId, sender_id: viewer.id, body: parsed.data.body })
    .select("id,sender_id,kind,body,created_at")
    .single();
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data };
}

export async function loadOlderMessages(conversationId: string, before: string): Promise<ActionResult<ChatMessage[]>> {
  if (!z.uuid().safeParse(conversationId).success || Number.isNaN(Date.parse(before))) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,kind,body,created_at")
    .eq("conversation_id", conversationId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: data.reverse() };
}

export async function markConversationRead(conversationId: string) {
  if (!z.uuid().safeParse(conversationId).success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

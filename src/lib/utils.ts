import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Result type returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Translate database/PostgREST errors into messages people can act on. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Try again.";
  const msg = error.message ?? "";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501" || /row-level security/i.test(msg)) {
    // Our own guard messages are written for people; RLS messages are not.
    return /row-level security/i.test(msg) ? "You don't have permission to do that." : msg;
  }
  if (error.code === "P0001" || error.code === "23514" || error.code === "22023" || error.code === "P0002") {
    return msg;
  }
  if (/fetch failed|network/i.test(msg)) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Try again.";
}

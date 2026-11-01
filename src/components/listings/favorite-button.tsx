"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite } from "@/app/(site)/favorites/actions";
import { cn } from "@/lib/utils";

/**
 * Optimistic save toggle. If the server call fails, React drops the
 * optimistic state automatically and we show the error.
 */
export function FavoriteButton({
  listingId,
  initial,
  signedIn,
  compact = false,
}: {
  listingId: string;
  initial: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useOptimistic(initial);
  const [pending, start] = useTransition();

  function onClick() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    start(async () => {
      setSaved(!saved);
      const r = await toggleFavorite(listingId, !saved);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors",
        compact
          ? "h-9 w-9 bg-surface/90 text-ink shadow-sm hover:bg-surface"
          : "h-10 border border-line-strong bg-surface px-4 text-sm hover:bg-paper",
        saved && "text-danger",
      )}
    >
      <Heart size={compact ? 18 : 18} fill={saved ? "currentColor" : "none"} aria-hidden />
      {compact ? null : saved ? "Saved" : "Save"}
    </button>
  );
}

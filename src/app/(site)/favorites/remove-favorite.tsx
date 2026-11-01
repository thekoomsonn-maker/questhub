"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "./actions";

export function RemoveFavorite({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" pending={pending} onClick={() => start(async () => {
      const r = await toggleFavorite(listingId, false);
      if (r.ok) router.refresh(); else toast.error(r.error);
    })}>Remove</Button>
  );
}

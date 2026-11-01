"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { blockUser } from "@/app/(site)/listing/actions";

export function BlockButton({ userId, initial }: { userId: string; initial: boolean }) {
  const [blocked, setBlocked] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await blockUser(userId, !blocked);
          if (r.ok) {
            setBlocked(!blocked);
            toast.success(r.message);
          } else toast.error(r.error);
        })
      }
      className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-danger"
    >
      <Ban size={14} aria-hidden /> {blocked ? "Unblock" : "Block"}
    </button>
  );
}

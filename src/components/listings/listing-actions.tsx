"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { contactSeller, recordView, revealPhone } from "@/app/(site)/listing/actions";

export function ContactActions({
  listingId,
  slug,
  title,
  canContact,
  secondary = false,
  phoneAvailable,
  signedIn,
}: {
  listingId: string;
  slug: string;
  title: string;
  canContact: boolean;
  /** Render as a secondary action when a stronger primary (Order online) sits above it. */
  secondary?: boolean;
  phoneAvailable: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phonePending, startPhone] = useTransition();
  const [phone, setPhone] = useState<{ phone: string | null; whatsapp: string | null } | null>(null);

  useEffect(() => {
    // Count one view per listing per browser session.
    const key = `viewed:${listingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: still record */
    }
    void recordView(listingId);
  }, [listingId]);

  const wa = phone?.whatsapp ?? phone?.phone;
  const waNumber = wa ? wa.replace(/^0/, "233").replace(/\D/g, "") : null;

  return (
    <div className="flex flex-col gap-2">
      {canContact ? (
        <Button
          size="lg"
          variant={secondary ? "secondary" : undefined}
          pending={pending}
          onClick={() =>
            start(async () => {
              const r = await contactSeller(listingId, slug);
              if (r && !r.ok) toast.error(r.error);
            })
          }
        >
          <MessageCircle size={18} aria-hidden /> Message seller
        </Button>
      ) : null}
      {phoneAvailable && canContact ? (
        phone ? (
          <div className="flex gap-2">
            <a href={`tel:${phone.phone}`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-field)] border border-line-strong bg-surface font-display text-lg font-bold tabular hover:bg-paper">
              <Phone size={18} aria-hidden /> {phone.phone}
            </a>
            {waNumber ? (
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, is "${title}" still available?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center rounded-[var(--radius-field)] border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-paper"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            pending={phonePending}
            onClick={() => {
              if (!signedIn) {
                router.push(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`);
                return;
              }
              startPhone(async () => {
                const r = await revealPhone(listingId);
                if (r.ok && r.data) setPhone(r.data);
                else if (!r.ok) toast.error(r.error);
              });
            }}
          >
            <Phone size={18} aria-hidden /> Show phone number
          </Button>
        )
      ) : null}
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied.");
          }
        } catch {
          /* share cancelled */
        }
      }}
    >
      <Share2 size={16} aria-hidden /> Share
    </Button>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { submitReport } from "@/app/(site)/listing/actions";
import { cn } from "@/lib/utils";

const reasons = [
  ["scam", "Scam or asks for payment upfront"],
  ["fake_or_misleading", "Fake or misleading"],
  ["prohibited_item", "Prohibited item"],
  ["spam", "Spam or duplicate"],
  ["harassment", "Harassment or abuse"],
  ["impersonation", "Pretending to be someone else"],
  ["other", "Something else"],
] as const;

export function ReportButton({
  targetType,
  targetId,
  signedIn,
  label = "Report",
  className,
  compact = false,
}: {
  targetType: "listing" | "user" | "message";
  targetId: string;
  signedIn: boolean;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!signedIn) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
          setError(null);
          ref.current?.showModal();
        }}
        className={cn("inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-danger", className)}
        aria-label={compact ? label : undefined}
      >
        <Flag size={14} aria-hidden /> {compact ? null : label}
      </button>
      <dialog ref={ref} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink backdrop:bg-ink/40">
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return setError("Choose a reason.");
            start(async () => {
              const r = await submitReport({ targetType, targetId, reason, details });
              if (!r.ok) return setError(r.error);
              ref.current?.close();
              setReason("");
              setDetails("");
              toast.success(r.message);
            });
          }}
        >
          <h2 className="font-display text-lg font-semibold">{label}</h2>
          <p className="text-sm text-ink-soft">Reports are private. The person you report won&apos;t know who sent it.</p>
          <Field id={`reason-${targetId}`} label="What's wrong?" error={error ?? undefined} required>
            <Select id={`reason-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {reasons.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field id={`details-${targetId}`} label="Details (optional)" hint="What happened? Include anything that helps us check.">
            <Textarea id={`details-${targetId}`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
            <Button type="submit" variant="danger" pending={pending}>Send report</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

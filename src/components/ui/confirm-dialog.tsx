"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "./button";
import { Field, Textarea } from "./field";

/**
 * Confirmation for destructive or sensitive actions. Uses the native
 * <dialog> element for focus trapping and Escape handling.
 */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  tone = "danger",
  requireReason = false,
  reasonLabel = "Reason",
  onConfirm,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `reason-${title.replace(/\W+/g, "-").toLowerCase()}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  const open = () => {
    setError(null);
    setReason("");
    setIsOpen(true);
  };

  return (
    <>
      {trigger(open)}
      <dialog
        ref={ref}
        onClose={() => setIsOpen(false)}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (requireReason && !reason.trim()) {
              setError("Add a reason. It is recorded in the audit log.");
              return;
            }
            start(async () => {
              const result = await onConfirm(reason.trim());
              if (result && !result.ok) {
                setError(result.error ?? "Something went wrong. Try again.");
                return;
              }
              setIsOpen(false);
            });
          }}
        >
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {body ? <div className="text-sm text-ink-soft">{body}</div> : null}
          {requireReason ? (
            <Field id={id} label={reasonLabel} error={error ?? undefined} required>
              <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
          ) : error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={tone} pending={pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

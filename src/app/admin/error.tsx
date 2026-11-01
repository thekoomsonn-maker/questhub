"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg py-10">
      <h1 className="font-display text-xl font-semibold">This admin page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-ink-soft">{error.message.includes("Administrator") ? "Your account no longer has admin access." : "Try again. If it keeps failing, check the server logs."}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}

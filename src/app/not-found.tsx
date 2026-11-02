import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Link href="/" aria-label="Home">
        <Logo />
      </Link>
      <h1 className="mt-8 font-display text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The listing may have been sold, removed, or the link is wrong.
      </p>
      <div className="mt-6 flex gap-2">
        <ButtonLink href="/search">Browse listings</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
    </main>
  );
}

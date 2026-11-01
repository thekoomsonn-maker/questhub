import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <AuthShell
      title="Sign in"
      intro="Welcome back. Pick up your chats and listings where you left them."
      footer={<>New to QuestHub? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-brand hover:underline">Create an account</Link></>}
    >
      <LoginForm next={next} linkError={sp.error === "link"} />
    </AuthShell>
  );
}

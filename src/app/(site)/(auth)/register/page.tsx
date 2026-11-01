import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      intro="Free to join. Save items, message sellers and post ads."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></>}
    >
      <RegisterForm />
    </AuthShell>
  );
}

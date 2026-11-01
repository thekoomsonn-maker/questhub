import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      intro="Enter the email you registered with and we'll send you a link to choose a new password."
      footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

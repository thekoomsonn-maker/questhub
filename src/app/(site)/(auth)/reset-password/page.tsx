import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await requireViewer("/reset-password");
  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm />
    </AuthShell>
  );
}

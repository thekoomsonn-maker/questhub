import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRegions } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/misc";
import { FormMessage } from "@/components/ui/field";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/account/profile">) {
  const viewer = await requireViewer("/account/profile");
  const supabase = await createClient();
  const [{ data: contacts }, regions, sp] = await Promise.all([
    supabase.from("profile_contacts").select("*").eq("user_id", viewer.id).single(),
    getRegions(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {sp.welcome ? (
        <div className="mb-4">
          <FormMessage tone="success">Your account is ready. Add a photo and your area so buyers know who they&apos;re dealing with.</FormMessage>
        </div>
      ) : null}
      <PageHeader title="Profile" description="Your name, photo and area appear on your listings and seller page." />
      <ProfileForm
        userId={viewer.id}
        profile={viewer.profile}
        contacts={contacts ?? { phone: null, whatsapp: null, show_phone: false, email_notifications: true }}
        regions={regions}
      />
    </div>
  );
}

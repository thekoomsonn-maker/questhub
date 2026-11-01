"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/misc";
import { UserAvatar } from "@/components/user-avatar";
import { checkImage, prepareImage, uploadToBucket } from "@/lib/upload";
import { site } from "@/config/site";
import type { Profile } from "@/lib/auth";
import type { Region } from "@/lib/data/catalog";
import type { ActionResult } from "@/lib/utils";
import { setAvatar, updateProfile } from "../actions";

type Contacts = { phone: string | null; whatsapp: string | null; show_phone: boolean; email_notifications: boolean };

export function ProfileForm({ userId, profile, contacts, regions }: { userId: string; profile: Profile; contacts: Contacts; regions: Region[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfile, null);
  const [avatar, setAvatarPath] = useState(profile.avatar_path);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Saved.");
  }, [state]);

  async function onAvatar(file: File) {
    const check = checkImage(file, site.limits.maxAvatarBytes);
    if (!check.ok) return toast.error(check.error);
    setUploading(true);
    try {
      const blob = await prepareImage(file, 512);
      const path = await uploadToBucket("avatars", `${userId}/${crypto.randomUUID()}.webp`, blob);
      const r = await setAvatar(path);
      if (!r.ok) throw new Error(r.error);
      setAvatarPath(path);
      toast.success("Photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4 p-5">
        <UserAvatar name={profile.display_name} path={avatar} size={72} />
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept={site.limits.imageTypes.join(",")} className="sr-only" id="avatar" onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
          <Button type="button" variant="secondary" size="sm" pending={uploading} onClick={() => fileRef.current?.click()}>
            <Camera size={16} aria-hidden /> {avatar ? "Change photo" : "Add photo"}
          </Button>
          <p className="text-xs text-ink-faint">JPG, PNG or WebP, up to 2 MB.</p>
        </div>
      </Card>

      <form action={action} className="flex flex-col gap-4" noValidate>
        {state && !state.ok && !state.fieldErrors ? <FormMessage>{state.error}</FormMessage> : null}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field id="displayName" label="Display name" required error={fe("displayName")} className="sm:col-span-2">
            <Input id="displayName" name="displayName" defaultValue={profile.display_name} maxLength={60} />
          </Field>
          <Field id="username" label="Profile link" hint={`${site.url.replace(/^https?:\/\//, "")}/seller/your-name`} error={fe("username")} className="sm:col-span-2">
            <Input id="username" name="username" defaultValue={profile.username ?? ""} placeholder="e.g. kofi-gadgets" maxLength={40} />
          </Field>
          <Field id="regionId" label="Region" error={fe("regionId")}>
            <Select id="regionId" name="regionId" defaultValue={profile.region_id ?? ""}>
              <option value="">Not set</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field id="city" label="Town or area" error={fe("city")}>
            <Input id="city" name="city" defaultValue={profile.city ?? ""} placeholder="e.g. East Legon" maxLength={80} />
          </Field>
          <Field id="bio" label="About you" hint="What you sell, opening hours, delivery options." error={fe("bio")} className="sm:col-span-2">
            <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={500} />
          </Field>
        </Card>

        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-medium">Contact details</h2>
            <p className="text-sm text-ink-soft">Private by default. Buyers can always message you in the app.</p>
          </div>
          <Field id="phone" label="Phone number" error={fe("phone")}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={contacts.phone ?? ""} placeholder="024 123 4567" />
          </Field>
          <Field id="whatsapp" label="WhatsApp number" error={fe("whatsapp")}>
            <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={contacts.whatsapp ?? ""} placeholder="Optional" />
          </Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="showPhone" defaultChecked={contacts.show_phone} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            <span>Show my phone number to signed-in buyers on my listings</span>
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="emailNotifications" defaultChecked={contacts.email_notifications} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            <span>Email me about new messages and listing updates (when email is set up)</span>
          </label>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" pending={pending}>Save profile</Button>
        </div>
      </form>
    </div>
  );
}

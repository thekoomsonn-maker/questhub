import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { staffLevelDescription, staffLevelLabel, type StaffLevel } from "@/lib/staff";
import { AdminHeader } from "../ui";
import { AddStaffForm, StaffRowActions } from "./staff-forms";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const viewer = await requireStaff("owner");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_staff");
  if (error) throw error;
  const levels: StaffLevel[] = ["owner", "manager", "moderator"];

  return (
    <>
      <AdminHeader title="Staff" description="Who can open the admin area and what each person can do. The database enforces these roles on every action." />

      <dl className="mb-6 grid gap-x-6 gap-y-3 border-y border-line py-4 sm:grid-cols-3">
        {levels.map((l) => (
          <div key={l}><dt className="font-medium">{staffLevelLabel[l]}</dt><dd className="text-sm text-ink-soft">{staffLevelDescription[l]}</dd></div>
        ))}
      </dl>

      <AddStaffForm />

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(data ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.display_name}{s.id === viewer.id ? <span className="ml-2 text-xs font-normal text-ink-faint">You</span> : null}</p>
              <p className="text-sm text-ink-soft">{s.email}, last signed in {s.last_sign_in_at ? formatDate(s.last_sign_in_at) : "never"}</p>
            </div>
            {s.id === viewer.id ? (
              <span className="text-sm">{staffLevelLabel[s.staff_level as StaffLevel]}</span>
            ) : (
              <StaffRowActions userId={s.id} name={s.display_name} level={s.staff_level as StaffLevel} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

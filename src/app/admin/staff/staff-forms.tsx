"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { staffLevelLabel, type StaffLevel } from "@/lib/staff";
import { addStaff, changeStaff } from "../dashboard-actions";

export function AddStaffForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<StaffLevel>("moderator");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addStaff(email, level, "Added from Staff page");
          if (r.ok) { toast.success(r.message); setEmail(""); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <Field id="staff-email" label="Add someone by email" hint="They need a QuestHub account first." className="min-w-64 flex-1">
        <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
      </Field>
      <Field id="staff-level" label="Role">
        <Select id="staff-level" value={level} onChange={(e) => setLevel(e.target.value as StaffLevel)}>
          <option value="moderator">Moderator</option><option value="manager">Manager</option><option value="owner">Owner</option>
        </Select>
      </Field>
      <Button type="submit" pending={pending}>Add to staff</Button>
    </form>
  );
}

export function StaffRowActions({ userId, name, level }: { userId: string; name: string; level: StaffLevel }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`lvl-${userId}`} className="sr-only">Role for {name}</label>
      <Select
        id={`lvl-${userId}`}
        defaultValue={level}
        disabled={pending}
        className="h-9 w-36"
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            const r = await changeStaff(userId, next, "Changed from Staff page");
            if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
          });
        }}
      >
        {(["owner", "manager", "moderator"] as const).map((l) => <option key={l} value={l}>{staffLevelLabel[l]}</option>)}
      </Select>
      <ConfirmDialog
        trigger={(open) => <Button size="sm" variant="ghost" onClick={open}>Remove</Button>}
        title={`Remove ${name} from staff?`}
        body="They lose access to the admin area straight away. Their account, listings and shop stay as they are."
        confirmLabel="Remove from staff"
        requireReason
        reasonLabel="Reason (kept in the audit log)"
        onConfirm={async (reason) => {
          const r = await changeStaff(userId, null, reason);
          if (r.ok) { toast.success(r.message); router.refresh(); }
          return r;
        }}
      />
    </div>
  );
}

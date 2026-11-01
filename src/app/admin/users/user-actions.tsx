"use client";

import { AdminActionButton } from "../action-button";
import { setUserRole, setUserStatus, setUserVerified } from "../actions";

export function UserActions({ id, status, role, verified }: { id: string; status: string; role: string; verified: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "active" ? (
        <AdminActionButton label="Suspend" tone="danger" title="Suspend this account?" body="Their listings are hidden and they can't post or message until reinstated." requireReason action={(r) => setUserStatus(id, "suspended", r)} />
      ) : (
        <AdminActionButton label="Reinstate" variant="primary" title="Reinstate this account?" requireReason action={(r) => setUserStatus(id, "active", r)} />
      )}
      {role !== "buyer" ? (
        verified ? (
          <AdminActionButton label="Remove verification" variant="ghost" title="Remove verified badge?" requireReason action={(r) => setUserVerified(id, false, r)} />
        ) : (
          <AdminActionButton label="Verify seller" title="Mark this seller as verified" body="Only do this after checking a Ghana Card or business registration. Buyers rely on this badge." requireReason reasonLabel="What did you check? (e.g. Ghana Card GHA-xxx seen on video call)" action={(r) => setUserVerified(id, true, r)} />
        )
      ) : null}
      {role !== "admin" ? (
        <AdminActionButton label="Make admin" variant="ghost" tone="danger" title="Give this user admin access?" body="Admins can moderate listings, suspend users and read reported messages." requireReason action={(r) => setUserRole(id, "admin", r)} />
      ) : (
        <AdminActionButton label="Remove admin" variant="ghost" title="Remove admin access?" requireReason action={(r) => setUserRole(id, "seller", r)} />
      )}
    </div>
  );
}

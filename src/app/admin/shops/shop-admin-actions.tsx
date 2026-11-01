"use client";

import { AdminActionButton } from "../action-button";
import { setShopFlags, setShopStatus } from "../shop-actions";

export function ShopAdminActions({ id, status, verified }: { id: string; status: string; verified: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "active" ? <AdminActionButton label="Approve" variant="primary" title="Make this shop public?" action={(r) => setShopStatus(id, "active", r)} /> : null}
      {status === "active" ? <AdminActionButton label="Suspend" tone="danger" title="Suspend this shop?" body="It disappears from the site and online ordering switches off for all its listings." requireReason action={(r) => setShopStatus(id, "suspended", r)} /> : null}
      {status === "active" && !verified ? <AdminActionButton label="Verify business" title="Mark as a verified business" body="Only after checking business registration (e.g. Registrar-General certificate) and the owner's Ghana Card." requireReason reasonLabel="What did you check?" action={(r) => setShopFlags(id, true, null, r)} /> : null}
      {verified ? <AdminActionButton label="Remove verification" variant="ghost" title="Remove verified badge?" requireReason action={(r) => setShopFlags(id, false, null, r)} /> : null}
      {status === "active" ? <AdminActionButton label="Feature 14 days" variant="ghost" title="Feature this shop for 14 days?" body="Use for paid placements confirmed outside the app, or test mode." requireReason action={(r) => setShopFlags(id, null, 14, r)} /> : null}
    </div>
  );
}

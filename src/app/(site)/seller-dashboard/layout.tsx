import { requireSeller } from "@/lib/auth";
import { DashboardNav } from "./dashboard-nav";

export default async function SellerDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSeller("/seller-dashboard");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <DashboardNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}

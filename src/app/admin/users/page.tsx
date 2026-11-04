import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterBar, Pager, Table } from "../ui";
import { UserActions } from "./user-actions";

const PAGE = 30;

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  await requireStaff("safety");
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const status = sp.status === "active" || sp.status === "suspended" ? sp.status : undefined;
  const role = sp.role === "buyer" || sp.role === "seller" || sp.role === "admin" ? sp.role : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", { p_query: q || undefined, p_status: status, p_role: role, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  if (error) throw error;
  const total = Number(data[0]?.total_count ?? 0);

  return (
    <>
      <AdminHeader title="Users" description={`${total} matching`} />
      <FilterBar>
        <Input name="q" defaultValue={q} placeholder="Name, username or email" className="h-10 w-64" aria-label="Search users" />
        <Select name="status" defaultValue={status ?? ""} className="h-10 w-36" aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
        <Select name="role" defaultValue={role ?? ""} className="h-10 w-32" aria-label="Role"><option value="">Any role</option><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="admin">Admin</option></Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </FilterBar>
      <Table head={["User", "Role", "Status", "Activity", "Actions"]} empty={!data.length}>
        {data.map((u) => (
          <tr key={u.id}>
            <td className="px-3 py-3">
              <a href={`/seller/${u.username ?? u.id}`} target="_blank" className="font-medium hover:text-brand">{u.display_name}</a>
              <p className="text-xs text-ink-soft">{u.email}</p>
              <p className="text-xs text-ink-faint">Joined {formatDate(u.created_at)}</p>
            </td>
            <td className="px-3 py-3"><Badge tone={u.role === "admin" ? "brand" : "neutral"}>{u.role}</Badge>{u.is_verified ? <div className="mt-1"><Badge tone="success">Verified</Badge></div> : null}</td>
            <td className="px-3 py-3">
              <Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge>
              {u.suspended_reason ? <p className="mt-1 max-w-[14rem] text-xs text-ink-faint">{u.suspended_reason}</p> : null}
              {u.deletion_requested_at ? <p className="mt-1 text-xs text-danger">Deletion requested {formatDate(u.deletion_requested_at)}</p> : null}
            </td>
            <td className="px-3 py-3 text-xs text-ink-soft">
              <p>{Number(u.listing_count)} listings</p>
              {Number(u.open_reports) ? <p className="text-danger">{Number(u.open_reports)} open reports</p> : null}
              <p>Last sign-in {u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "never"}</p>
            </td>
            <td className="px-3 py-3">
              {u.id === viewer.id ? <span className="text-xs text-ink-faint">This is you</span> : <UserActions id={u.id} status={u.status} role={u.role} verified={u.is_verified} />}
            </td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/users" params={{ q, status, role }} page={page} pages={Math.ceil(total / PAGE)} />
    </>
  );
}

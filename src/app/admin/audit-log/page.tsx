import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterBar, Pager, Table } from "../ui";

const PAGE = 50;

export default async function AuditLog({ searchParams }: PageProps<"/admin/audit-log">) {
  await requireStaff("owner");
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from("admin_actions").select("id,action,target_type,target_id,reason,metadata,created_at,actor:profiles(display_name)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (action) q = q.ilike("action", `%${action.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return (
    <>
      <AdminHeader title="Audit log" description="Every moderation, account and configuration change. Entries can't be edited or deleted." />
      <FilterBar>
        <Input name="action" defaultValue={action} placeholder="Filter by action, e.g. listing.remove" className="h-10 w-72" aria-label="Filter by action" />
        <Button type="submit" variant="secondary">Filter</Button>
      </FilterBar>
      <Table head={["When", "Who", "Action", "Target", "Reason"]} empty={!data?.length}>
        {data?.map((a) => {
          const meta = a.metadata as Record<string, string>;
          return (
            <tr key={a.id}>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{formatDate(a.created_at)} {formatTime(a.created_at)}</td>
              <td className="px-3 py-2.5">{a.actor?.display_name ?? "System"}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{a.action}</td>
              <td className="px-3 py-2.5 text-ink-soft">{a.target_type}{meta?.title || meta?.name ? `: ${meta.title ?? meta.name}` : ""}<div className="font-mono text-[10px] text-ink-faint">{a.target_id}</div></td>
              <td className="max-w-xs px-3 py-2.5 text-ink-soft">{a.reason ?? "—"}</td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/audit-log" params={{ action }} page={page} pages={Math.ceil((count ?? 0) / PAGE)} />
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminHeader, Table, Tabs } from "../ui";
import { ReportActions } from "./report-actions";

const reasons: Record<string, string> = { scam: "Scam", fake_or_misleading: "Fake / misleading", prohibited_item: "Prohibited item", spam: "Spam", harassment: "Harassment", impersonation: "Impersonation", other: "Other" };
const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof STATUSES)[number]) : "open";
  const supabase = await createClient();
  const [{ data, error }, { data: all }] = await Promise.all([
    supabase
      .from("reports")
      .select("id,target_type,reason,details,status,resolution_note,created_at,resolved_at,message_id,reporter:profiles!reports_reporter_id_fkey(display_name),reported:profiles!reports_reported_user_id_fkey(id,display_name,status),listing:listings(id,slug,title,status)")
      .eq("status", status)
      .order("created_at", { ascending: status === "open" })
      .limit(100),
    supabase.from("reports").select("status"),
  ]);
  if (error) throw error;

  return (
    <>
      <AdminHeader title="Reports" description="Reporters stay anonymous to the people they report. Messages are visible only when reported." />
      <Tabs base="/admin/reports" current={status} tabs={STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: (all ?? []).filter((r) => r.status === s).length }))} />
      <Table head={["Report", "About", "Reported by", "When", "Actions"]} empty={!data?.length}>
        {data?.map((r) => (
          <tr key={r.id}>
            <td className="px-3 py-3">
              <Badge tone={r.reason === "scam" || r.reason === "prohibited_item" ? "danger" : "neutral"}>{reasons[r.reason]}</Badge>
              {r.details ? <p className="mt-1 max-w-sm whitespace-pre-line text-sm">{r.details}</p> : null}
              {r.resolution_note ? <p className="mt-1 text-xs text-ink-faint">Decision: {r.resolution_note}</p> : null}
            </td>
            <td className="px-3 py-3">
              <p className="text-xs uppercase text-ink-faint">{r.target_type}</p>
              {r.listing ? <Link href={`/listing/${r.listing.slug}`} target="_blank" className="block font-medium hover:text-brand">{r.listing.title}</Link> : null}
              {r.listing?.status === "removed" ? <Badge tone="danger">Removed</Badge> : null}
              {r.reported ? <Link href={`/admin/users?q=${encodeURIComponent(r.reported.display_name)}`} className="block text-ink-soft hover:text-brand">{r.reported.display_name}</Link> : null}
              {r.reported?.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : null}
            </td>
            <td className="px-3 py-3 text-ink-soft">{r.reporter?.display_name ?? "Deleted user"}</td>
            <td className="px-3 py-3 text-ink-soft">{timeAgo(r.created_at)}</td>
            <td className="px-3 py-3">
              <ReportActions
                id={r.id}
                status={r.status}
                listingId={r.listing && r.listing.status !== "removed" ? r.listing.id : null}
                userId={r.reported && r.reported.status !== "suspended" ? r.reported.id : null}
                hasMessage={Boolean(r.message_id)}
              />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

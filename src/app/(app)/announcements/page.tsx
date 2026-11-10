import Link from "next/link";
import clsx from "clsx";
import { Paperclip, Plus } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { pageOf, PAGE_SIZE } from "@/lib/queries";
import { fmtDateTime } from "@/lib/format";
import { ANN_STATUS, PRIORITY } from "@/lib/labels";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader, Pagination } from "@/components/ui";

const tone = (s: string) => (s === "published" ? "success" : s === "pending" ? "warning" : s === "scheduled" ? "info" : "neutral") as any;

export default async function Announcements({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("announcements");
  const { supabase } = ctx;
  const leader = can(ctx.role, PERMS.approveAnnouncement);
  const compose = can(ctx.role, PERMS.composeAnnouncement);
  const tab = sp.tab === "mine" && compose ? "mine" : sp.tab === "pending" && leader ? "pending" : sp.tab === "all" && leader ? "all" : "feed";
  const page = pageOf(sp.page);

  let q = supabase.from("announcements").select("id, title, body, status, priority, published_at, created_at, publish_at, attachment_path, profiles:created_by(full_name)", { count: "exact" });
  if (tab === "feed") {
    const now = new Date().toISOString();
    q = q.in("status", ["published", "scheduled"]).or(`publish_at.is.null,publish_at.lte.${now}`).or(`expires_at.is.null,expires_at.gt.${now}`).order("published_at", { ascending: false });
  }
  if (tab === "mine") q = q.eq("created_by", ctx.userId).order("created_at", { ascending: false });
  if (tab === "pending") q = q.eq("status", "pending").order("created_at");
  if (tab === "all") q = q.order("created_at", { ascending: false });
  const { data, count, error } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const tabs = [
    { k: "feed", label: "Bảng tin", show: true },
    { k: "mine", label: "Tôi soạn", show: compose },
    { k: "pending", label: "Chờ duyệt", show: leader },
    { k: "all", label: "Tất cả", show: leader },
  ].filter((t) => t.show);

  return (
    <>
      <PageHeader title="Thông báo" description="Thông báo nội bộ trong hệ thống. Email/SMS/Zalo chưa được tích hợp." actions={compose && <ButtonLink href="/announcements/new"><Plus className="h-4 w-4" /> Soạn thông báo</ButtonLink>} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <Link key={t.k} href={`?tab=${t.k}`} role="tab" aria-selected={tab === t.k}
            className={clsx("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === t.k ? "border-brand text-brand-dark" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </div>
      {error ? <Alert tone="danger">Không tải được: {error.message}</Alert> : !data?.length ? <Card><EmptyState title="Chưa có thông báo" /></Card> : (
        <div className="space-y-3">
          {data.map((a: any) => (
            <Link key={a.id} href={`/announcements/${a.id}`} className={clsx("block rounded-xl border bg-surface p-4 transition hover:border-brand/50", a.priority === "urgent" ? "border-danger/40" : "border-line")}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{a.title}</h3>
                {a.priority !== "normal" && <Badge tone="danger">{PRIORITY[a.priority]}</Badge>}
                {tab !== "feed" && <Badge tone={tone(a.status)}>{ANN_STATUS[a.status]}</Badge>}
                {a.attachment_path && <Paperclip className="h-4 w-4 text-muted" aria-label="Có tệp đính kèm" />}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
              <p className="mt-2 text-xs text-muted">{a.profiles?.full_name ?? "—"} · {fmtDateTime(a.published_at ?? a.created_at)}</p>
            </Link>
          ))}
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={sp as any} />
        </div>
      )}
    </>
  );
}

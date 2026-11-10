import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import { ANN_AUDIENCE, ANN_STATUS, PRIORITY } from "@/lib/labels";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { archiveAnnouncement, reviewAnnouncement } from "../actions";

const SAVED: Record<string, string> = { draft: "Đã lưu nháp.", pending: "Đã gửi duyệt.", published: "Đã phát hành.", scheduled: "Đã lên lịch phát hành." };

export default async function AnnouncementDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireModule("announcements");
  const { data: a } = await ctx.supabase
    .from("announcements")
    .select("*, author:created_by(full_name), approver:approved_by(full_name), publisher:published_by(full_name)")
    .eq("id", id).maybeSingle();
  if (!a) notFound();
  const leader = can(ctx.role, PERMS.approveAnnouncement);
  const mine = a.created_by === ctx.userId;

  let audience = ANN_AUDIENCE[a.audience_type];
  if (a.audience_type === "role") audience += ": " + (a.audience_roles as AppRole[]).map((r) => ROLE_LABELS[r]).join(", ");
  if (["level", "class", "department"].includes(a.audience_type) && a.audience_ids.length) {
    const table = a.audience_type === "level" ? "school_levels" : a.audience_type === "class" ? "classes" : "departments";
    const { data: names } = await ctx.supabase.from(table).select("name").in("id", a.audience_ids);
    audience += ": " + (names ?? []).map((n: any) => n.name).join(", ");
  }

  return (
    <>
      <Link href="/announcements" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Thông báo</Link>
      {sp.saved && SAVED[sp.saved] && <div className="mb-3"><Alert tone="success">{SAVED[sp.saved]}</Alert></div>}
      <PageHeader
        title={a.title}
        actions={<><Badge tone={a.status === "published" ? "success" : a.status === "pending" ? "warning" : "neutral"}>{ANN_STATUS[a.status]}</Badge>{a.priority !== "normal" && <Badge tone="danger">{PRIORITY[a.priority]}</Badge>}</>}
      />
      {a.return_reason && a.status === "draft" && <div className="mb-3"><Alert tone="warning">Bị trả lại: {a.return_reason}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <article className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.body}</article>
          {a.attachment_path && (
            <a href={`/api/files/announcement/${a.id}`} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-page">
              <Paperclip className="h-4 w-4" /> Tải tệp đính kèm
            </a>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Thông tin">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Gửi tới</dt><dd>{audience}</dd></div>
              <div><dt className="text-muted">Người soạn</dt><dd>{a.author?.full_name ?? "—"} · {fmtDateTime(a.created_at)}</dd></div>
              {a.approved_at && <div><dt className="text-muted">Người duyệt</dt><dd>{a.approver?.full_name ?? "—"} · {fmtDateTime(a.approved_at)}</dd></div>}
              {a.published_at && <div><dt className="text-muted">Phát hành</dt><dd>{a.publisher?.full_name ?? "—"} · {fmtDateTime(a.published_at)}</dd></div>}
              {a.publish_at && <div><dt className="text-muted">Lịch phát hành</dt><dd>{fmtDateTime(a.publish_at)}</dd></div>}
              <div><dt className="text-muted">Hết hiệu lực</dt><dd>{a.expires_at ? fmtDateTime(a.expires_at) : "Không giới hạn"}</dd></div>
            </dl>
          </Card>
          {(mine || leader) && ["draft", "pending"].includes(a.status) && (
            <ButtonLink href={`/announcements/${a.id}/edit`} variant="secondary" className="w-full">Sửa thông báo</ButtonLink>
          )}
          {leader && a.status === "pending" && (
            <Card title="Duyệt thông báo">
              <ActionForm action={reviewAnnouncement} className="space-y-2">
                <input type="hidden" name="id" value={a.id} />
                <textarea name="reason" rows={2} className="input" placeholder="Lý do (bắt buộc nếu trả lại)" maxLength={500} />
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve">Duyệt & phát hành</SubmitButton>
                  <SubmitButton name="decision" value="return" variant="secondary">Trả lại</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          )}
          {(leader || mine) && ["published", "scheduled"].includes(a.status) && (
            <ActionButton action={archiveAnnouncement} fields={{ id: a.id }} variant="danger" confirm="Thu hồi thông báo này? Người nhận sẽ không còn thấy.">Thu hồi thông báo</ActionButton>
          )}
        </div>
      </div>
    </>
  );
}

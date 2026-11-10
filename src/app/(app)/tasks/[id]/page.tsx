import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { updateTask } from "../actions";
import { TaskStatus } from "../status";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireModule("tasks");
  const { data: t } = await ctx.supabase.from("tasks").select("*, assignee:assignee_id(full_name), assigner:assigner_id(full_name), documents(id, title)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: updates } = await ctx.supabase.from("task_updates").select("id, content, from_status, to_status, created_at, author:author_id(full_name)").eq("task_id", id).order("created_at", { ascending: false });
  const today = todayVN();

  return (
    <>
      <Link href="/tasks" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Công việc</Link>
      <PageHeader title={t.title} actions={<TaskStatus status={t.status} due={t.due_date} today={today} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Mô tả">
            <p className="whitespace-pre-wrap text-sm">{t.description || "—"}</p>
            {t.documents && <p className="mt-3 text-sm">Tài liệu: <a className="link" href={`/api/files/document/${t.documents.id}`}>{t.documents.title}</a></p>}
          </Card>
          <Card title="Nhật ký cập nhật">
            <ol className="space-y-3 border-l-2 border-line pl-4">
              {(updates ?? []).map((u: any) => (
                <li key={u.id} className="relative text-sm">
                  <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
                  <p>
                    <span className="font-medium">{u.author?.full_name ?? "Hệ thống"}</span>{" "}
                    {u.to_status && <span className="text-muted">{u.from_status ? `${TASK_STATUS[u.from_status]} → ` : ""}{TASK_STATUS[u.to_status]}</span>}
                  </p>
                  {u.content && <p>{u.content}</p>}
                  <p className="text-xs text-muted">{fmtDateTime(u.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Thông tin">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Người giao</dt><dd>{t.assigner?.full_name ?? "—"}</dd></div>
              <div><dt className="text-muted">Người phụ trách</dt><dd>{t.assignee?.full_name ?? "—"}</dd></div>
              <div><dt className="text-muted">Hạn</dt><dd>{fmtDate(t.due_date)}</dd></div>
              <div><dt className="text-muted">Tạo lúc</dt><dd>{fmtDateTime(t.created_at)}</dd></div>
            </dl>
          </Card>
          <Card title="Cập nhật tiến độ">
            <ActionForm action={updateTask} className="space-y-3">
              <input type="hidden" name="id" value={t.id} />
              <Field label="Trạng thái"><select name="status" defaultValue={t.status} className="input">{Object.entries(TASK_STATUS).filter(([k]) => k !== "overdue").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Ghi chú"><textarea name="content" rows={3} className="input" maxLength={2000} /></Field>
              <SubmitButton>Cập nhật</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

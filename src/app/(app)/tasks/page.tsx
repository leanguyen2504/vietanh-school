import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { pageOf, PAGE_SIZE, staffProfiles } from "@/lib/queries";
import { fmtDate, todayVN } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card, EmptyState, Field, PageHeader, Pagination, TableWrap, btn } from "@/components/ui";
import { createTask } from "./actions";
import { TaskStatus } from "./status";

type SP = { scope?: string; status?: string; assignee?: string; page?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireModule("tasks");
  const today = todayVN();
  const page = pageOf(sp.page);
  const people = await staffProfiles(ctx);

  let q = ctx.supabase.from("tasks").select("id, title, status, due_date, assignee:assignee_id(full_name), assigner:assigner_id(full_name)", { count: "exact" });
  if (sp.scope === "mine") q = q.eq("assignee_id", ctx.userId);
  if (sp.scope === "assigned") q = q.eq("assigner_id", ctx.userId);
  if (sp.assignee) q = q.eq("assignee_id", sp.assignee);
  if (sp.status === "overdue") q = q.neq("status", "done").lt("due_date", today);
  else if (sp.status) q = q.eq("status", sp.status);
  else q = q.neq("status", "done");
  const { data, count, error } = await q.order("due_date", { ascending: true, nullsFirst: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data: docs } = await ctx.supabase.from("documents").select("id, title").order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <PageHeader title="Công việc" description="Giao việc, theo dõi tiến độ và lịch sử cập nhật." />
      {can(ctx.role, PERMS.createTasks) && (
        <details className="mb-4 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium text-brand-dark">+ Giao việc mới</summary>
          <ActionForm action={createTask} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tiêu đề *" className="sm:col-span-2"><input name="title" required className="input" /></Field>
            <Field label="Người phụ trách *"><select name="assignee_id" required className="input"><option value="">Chọn</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>
            <Field label="Hạn hoàn thành"><input type="date" name="due_date" className="input" /></Field>
            <Field label="Mô tả" className="sm:col-span-2 lg:col-span-3"><textarea name="description" rows={2} className="input" /></Field>
            <Field label="Tài liệu liên quan"><select name="document_id" className="input"><option value="">—</option>{(docs ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
            <div><SubmitButton>Giao việc</SubmitButton></div>
          </ActionForm>
        </details>
      )}
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-4">
          <select name="scope" defaultValue={sp.scope ?? ""} className="input" aria-label="Phạm vi">
            <option value="">Tất cả việc tôi được xem</option><option value="mine">Việc giao cho tôi</option><option value="assigned">Việc tôi giao</option>
          </select>
          <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Trạng thái">
            <option value="">Chưa hoàn thành</option>{Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className="input" aria-label="Người phụ trách">
            <option value="">Mọi người phụ trách</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <button className={btn("primary")}>Lọc</button>
        </form>
        {error ? <Alert tone="danger">Không tải được: {error.message}</Alert> : !data?.length ? <EmptyState title="Không có công việc" /> : (
          <>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Công việc</th><th>Người phụ trách</th><th>Người giao</th><th>Hạn</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {data.map((t: any) => (
                    <tr key={t.id} className="hover:bg-page">
                      <td><Link className="link" href={`/tasks/${t.id}`}>{t.title}</Link></td>
                      <td>{t.assignee?.full_name ?? "—"}</td>
                      <td className="text-muted">{t.assigner?.full_name ?? "—"}</td>
                      <td className="whitespace-nowrap">{fmtDate(t.due_date)}</td>
                      <td><TaskStatus status={t.status} due={t.due_date} today={today} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={sp as any} />
          </>
        )}
      </Card>
    </>
  );
}

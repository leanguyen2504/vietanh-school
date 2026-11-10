import { Download } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { fmtDate, todayVN } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";
import { Alert, Card, EmptyState, PageHeader, TableWrap, btn } from "@/components/ui";

function Bar({ value, max, tone = "bg-brand" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-page" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("reports");
  const { supabase, year } = ctx;
  if (!year) return <EmptyState title="Chưa có năm học" />;
  const today = todayVN();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const since = new Date(Date.now() - 180 * 864e5).toISOString();

  const [enr, att, tasks, anns] = await Promise.all([
    supabase.rpc("report_enrollment_summary", { p_year: year.id }),
    supabase.rpc("report_attendance_day", { p_year: year.id, p_date: date }),
    supabase.from("tasks").select("status, due_date, assignee:assignee_id(full_name)"),
    supabase.from("announcements").select("published_at").in("status", ["published", "scheduled", "archived"]).gte("published_at", since),
  ]);
  const err = [enr, att, tasks, anns].find((r) => r.error)?.error;

  const classes = (enr.data ?? []) as any[];
  const byGrade = new Map<string, { level: string; n: number; classes: number }>();
  classes.forEach((c) => {
    const g = byGrade.get(c.grade_name) ?? { level: c.level_name, n: 0, classes: 0 };
    g.n += Number(c.student_count); g.classes += 1; byGrade.set(c.grade_name, g);
  });
  const byLevel = new Map<string, number>();
  classes.forEach((c) => byLevel.set(c.level_name, (byLevel.get(c.level_name) ?? 0) + Number(c.student_count)));
  const total = classes.reduce((s, c) => s + Number(c.student_count), 0);
  const maxGrade = Math.max(0, ...Array.from(byGrade.values()).map((g) => g.n));

  const attRows = (att.data ?? []) as any[];
  const taskRows = (tasks.data ?? []) as any[];
  const taskStatus = new Map<string, number>();
  const byAssignee = new Map<string, { open: number; overdue: number; done: number }>();
  taskRows.forEach((t) => {
    const k = t.status !== "done" && t.due_date && t.due_date < today ? "overdue" : t.status;
    taskStatus.set(k, (taskStatus.get(k) ?? 0) + 1);
    const name = t.assignee?.full_name ?? "Chưa giao";
    const a = byAssignee.get(name) ?? { open: 0, overdue: 0, done: 0 };
    if (k === "done") a.done++; else if (k === "overdue") a.overdue++; else a.open++;
    byAssignee.set(name, a);
  });
  const months = new Map<string, number>();
  ((anns.data ?? []) as any[]).forEach((a) => { const k = a.published_at.slice(0, 7); months.set(k, (months.get(k) ?? 0) + 1); });
  const monthList = Array.from(months.entries()).sort();
  const maxMonth = Math.max(0, ...monthList.map(([, n]) => n));

  return (
    <>
      <PageHeader title="Báo cáo" description={`Năm học ${year.name}. Số liệu tổng hợp, không chứa thông tin cá nhân.`} />
      {err && <div className="mb-4"><Alert tone="danger">Một phần báo cáo không tải được: {err.message}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Sĩ số theo khối (tổng ${total} học sinh)`} actions={<a className={btn("ghost")} href="/api/export/report?type=enrollment"><Download className="h-4 w-4" /> CSV</a>}>
          <div className="mb-4 flex flex-wrap gap-3">
            {Array.from(byLevel.entries()).map(([l, n]) => <div key={l} className="rounded-lg bg-brand-soft px-3 py-2 text-sm"><span className="text-muted">{l}:</span> <strong>{n}</strong></div>)}
          </div>
          <ul className="space-y-2 text-sm">
            {Array.from(byGrade.entries()).map(([g, v]) => (
              <li key={g} className="grid grid-cols-[5rem_1fr_6rem] items-center gap-2">
                <span>{g}</span><Bar value={v.n} max={maxGrade} /><span className="text-right text-muted">{v.n} HS · {v.classes} lớp</span>
              </li>
            ))}
          </ul>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-brand-dark">Chi tiết theo lớp</summary>
            <TableWrap>
              <table className="table mt-2"><thead><tr><th>Cấp</th><th>Khối</th><th>Lớp</th><th>Sĩ số</th></tr></thead>
                <tbody>{classes.map((c) => <tr key={c.class_id}><td>{c.level_name}</td><td>{c.grade_name}</td><td>{c.class_name}</td><td>{c.student_count}</td></tr>)}</tbody>
              </table>
            </TableWrap>
          </details>
        </Card>

        <Card title={`Điểm danh ngày ${fmtDate(date)}`} actions={<a className={btn("ghost")} href={`/api/export/report?type=attendance&date=${date}`}><Download className="h-4 w-4" /> CSV</a>}>
          <form className="mb-3 flex gap-2"><input type="date" name="date" defaultValue={date} max={today} className="input w-auto" aria-label="Ngày" /><button className={btn("secondary")}>Xem</button></form>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Lớp</th><th>Tình trạng</th><th>Có mặt</th><th>P</th><th>K</th><th>Muộn</th></tr></thead>
              <tbody>
                {attRows.map((r) => (
                  <tr key={r.class_id}>
                    <td>{r.class_name}</td>
                    <td>{r.session_status === "confirmed" ? "✓ Xác nhận" : r.session_status === "draft" ? "● Nháp" : "! Chưa"}</td>
                    <td>{r.present}/{r.total}</td><td>{r.excused}</td><td>{r.unexcused}</td><td>{r.late}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-2 text-xs text-muted">P: nghỉ có phép · K: nghỉ không phép</p>
        </Card>

        <Card title="Công việc theo trạng thái" actions={<a className={btn("ghost")} href="/api/export/report?type=tasks"><Download className="h-4 w-4" /> CSV</a>}>
          {taskRows.length === 0 ? <p className="text-sm text-muted">Chưa có công việc trong phạm vi của bạn.</p> : (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-sm">
                {["new", "in_progress", "waiting", "overdue", "done"].map((k) => <span key={k} className="rounded-lg bg-page px-3 py-1.5">{TASK_STATUS[k]}: <strong>{taskStatus.get(k) ?? 0}</strong></span>)}
              </div>
              <TableWrap>
                <table className="table"><thead><tr><th>Người phụ trách</th><th>Đang mở</th><th>Quá hạn</th><th>Hoàn thành</th></tr></thead>
                  <tbody>{Array.from(byAssignee.entries()).map(([n, a]) => <tr key={n}><td>{n}</td><td>{a.open}</td><td className={a.overdue ? "font-semibold text-danger" : ""}>{a.overdue}</td><td>{a.done}</td></tr>)}</tbody>
                </table>
              </TableWrap>
            </>
          )}
        </Card>

        <Card title="Thông báo phát hành (6 tháng)">
          {monthList.length === 0 ? <p className="text-sm text-muted">Chưa có thông báo.</p> : (
            <ul className="space-y-2 text-sm">
              {monthList.map(([m, n]) => (
                <li key={m} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2"><span>{m.slice(5)}/{m.slice(0, 4)}</span><Bar value={n} max={maxMonth} tone="bg-info" /><span className="text-right">{n}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

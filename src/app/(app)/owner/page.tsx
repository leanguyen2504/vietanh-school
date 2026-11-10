import Link from "next/link";
import { AlertTriangle, BookOpen, ClipboardCheck, GraduationCap, UserSquare2, Wallet } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { addDays, fmtDate, fmtDateTime, fmtMoneyShort, fmtMonth, todayVN } from "@/lib/format";
import { loadEntries, summarize } from "@/lib/finance";
import { Alert, Badge, Card, DenyNotice, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ColumnChart, HBarList, PairBarChart } from "@/components/charts";

const ENTITY: Record<string, string> = {
  students: "Học sinh", staff: "Nhân sự", classes: "Lớp học", enrollments: "Xếp lớp", teaching_assignments: "Phân công",
  attendance_sessions: "Điểm danh", announcements: "Thông báo", events: "Lịch công tác", tasks: "Công việc", documents: "Tài liệu",
  menus: "Thực đơn", academic_years: "Năm học", profiles: "Tài khoản", finance_entries: "Thu/chi", finance_categories: "Hạng mục tài chính",
  app_settings: "Cấu hình", student_guardians: "Người giám hộ", school_levels: "Cấp học", grades: "Khối", departments: "Tổ/bộ phận",
};
const ACTION: Record<string, string> = { insert: "Thêm", update: "Sửa", delete: "Xóa", export: "Xuất dữ liệu" };

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("owner");
  const { supabase, year } = ctx;
  const today = todayVN();
  if (!year) return (<><PageHeader title="Tổng quan điều hành" /><EmptyState title="Chưa có năm học" /></>);

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
  const sixMonthsFrom = `${addDays(`${today.slice(0, 7)}-01`, -160).slice(0, 7)}-01`;
  const nowIso = new Date().toISOString();

  const [summary, staffRes, attDays, fin, pendingFin, pendingAnns, overdue, events, audit] = await Promise.all([
    supabase.rpc("report_enrollment_summary", { p_year: year.id }),
    supabase.from("staff").select("id, status, departments(name)").eq("status", "working"),
    Promise.all(days.map((d) => supabase.rpc("report_attendance_day", { p_year: year.id, p_date: d }))),
    loadEntries(ctx, sixMonthsFrom, today),
    supabase.from("finance_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("announcements").select("id, title, created_at").eq("status", "pending").order("created_at").limit(5),
    supabase.from("tasks").select("id, title, due_date, assignee:profiles!tasks_assignee_id_fkey(full_name)").neq("status", "done").lt("due_date", today).order("due_date").limit(6),
    supabase.from("events").select("id, title, start_at, location").gte("start_at", nowIso).lte("start_at", new Date(Date.now() + 7 * 864e5).toISOString()).order("start_at").limit(6),
    supabase.from("audit_logs").select("id, action, entity, created_at, actor_id").order("created_at", { ascending: false }).limit(12),
  ]);

  const actorIds = [...new Set(((audit.data ?? []) as any[]).map((a) => a.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] as any[] };
  const actorName = new Map<string, string>(((actors ?? []) as any[]).map((p) => [p.id, p.full_name]));
  const classes = (summary.data ?? []) as any[];
  const totalStudents = classes.reduce((s, c) => s + Number(c.student_count), 0);
  const byLevel = new Map<string, number>();
  const byGrade = new Map<string, number>();
  classes.forEach((c) => {
    byLevel.set(c.level_name, (byLevel.get(c.level_name) ?? 0) + Number(c.student_count));
    byGrade.set(c.grade_name, (byGrade.get(c.grade_name) ?? 0) + Number(c.student_count));
  });
  const staff = (staffRes.data ?? []) as any[];
  const byDept = new Map<string, number>();
  staff.forEach((s) => byDept.set(s.departments?.name ?? "Chưa phân bộ phận", (byDept.get(s.departments?.name ?? "Chưa phân bộ phận") ?? 0) + 1));

  const attSeries = days.map((d, i) => {
    const rows = (attDays[i].data ?? []) as any[];
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const present = rows.reduce((s, r) => s + Number(r.present) + Number(r.late), 0);
    const done = rows.filter((r) => r.session_status === "confirmed").length;
    return { key: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, value: total ? Math.round((present / total) * 100) : null, note: `${done}/${rows.length} lớp đã chốt`, rows };
  });
  const todayAtt = attSeries.at(-1)!;
  const notDoneToday = todayAtt.rows.filter((r: any) => r.session_status !== "confirmed");

  const fs = summarize(fin.rows, sixMonthsFrom, today);
  const thisMonth = fs.months.at(-1);

  return (
    <>
      <PageHeader
        title="Tổng quan điều hành"
        description={`Chủ đầu tư · Năm học ${year.name} · Hôm nay ${fmtDate(today)}`}
      />
      {sp.denied && <div className="mb-4"><DenyNotice /></div>}
      {summary.error && <div className="mb-4"><Alert tone="danger">Không tải được số liệu: {summary.error.message}</Alert></div>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Học sinh đang học" value={totalStudents} hint={[...byLevel].map(([k, v]) => `${k}: ${v}`).join(" · ")} href="/students" icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label="Lớp học" value={classes.length} hint={`Bình quân ${classes.length ? Math.round(totalStudents / classes.length) : 0} HS/lớp`} href="/classes" icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Nhân sự đang làm việc" value={staff.length} href="/staff" icon={<UserSquare2 className="h-5 w-5" />} />
        <StatCard label="Chuyên cần hôm nay" value={todayAtt.value == null ? "—" : `${todayAtt.value}%`} hint={todayAtt.note} href="/attendance" icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard
          label={thisMonth ? `Thu − chi ${fmtMonth(thisMonth.ym)}` : "Tài chính tháng này"}
          value={thisMonth ? <span className={thisMonth.income - thisMonth.expense < 0 ? "text-danger" : "text-success"}>{fmtMoneyShort(thisMonth.income - thisMonth.expense)}</span> : "—"}
          hint={thisMonth ? `Thu ${fmtMoneyShort(thisMonth.income)} · Chi ${fmtMoneyShort(thisMonth.expense)}` : undefined}
          href="/finance" icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Cần chú ý" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-2">
              <Link href="/finance?status=pending#so-thu-chi" className="link">Khoản thu/chi chờ duyệt</Link>
              <Badge tone={(pendingFin.count ?? 0) ? "warning" : "success"}>{pendingFin.count ?? 0}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <Link href="/announcements?tab=pending" className="link">Thông báo chờ duyệt</Link>
              <Badge tone={pendingAnns.data?.length ? "warning" : "success"}>{pendingAnns.data?.length ?? 0}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <Link href="/attendance" className="link">Lớp chưa chốt điểm danh hôm nay</Link>
              <Badge tone={notDoneToday.length ? "danger" : "success"}>{notDoneToday.length}</Badge>
            </li>
            <li>
              <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Công việc quá hạn</p>
              {!overdue.data?.length ? <p className="text-muted">Không có công việc quá hạn.</p> : (
                <ul className="space-y-1">
                  {(overdue.data as any[]).map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks/${t.id}`} className="link">{t.title}</Link>
                      <span className="block text-xs text-muted">Hạn {fmtDate(t.due_date)}{t.assignee?.full_name ? ` · ${t.assignee.full_name}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </Card>

        <Card title="Tài chính 6 tháng gần nhất" className="lg:col-span-2" actions={<Link className="link text-sm" href="/finance">Mở dashboard tài chính</Link>}>
          <PairBarChart data={fs.months.map((m) => ({ key: m.ym, label: fmtMonth(m.ym), a: m.income, b: m.expense }))} aLabel="Thu" bLabel="Chi" format={fmtMoneyShort} height={180} />
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Tỷ lệ chuyên cần 7 ngày">
          <ColumnChart data={attSeries} format={(n) => `${n}%`} max={100} />
          <p className="mt-2 text-xs text-muted">Có mặt + đi muộn trên tổng số học sinh đã điểm danh. Ngày nghỉ hiển thị “—”.</p>
        </Card>
        <Card title="Sĩ số theo khối">
          <HBarList items={[...byGrade].map(([label, value]) => ({ label, value }))} tone="brand" format={(n) => `${n} HS`} />
        </Card>
        <Card title="Nhân sự theo bộ phận">
          <HBarList items={[...byDept].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} tone="brand" format={(n) => `${n} người`} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Lịch công tác 7 ngày tới" actions={<Link className="link text-sm" href="/events">Xem lịch</Link>}>
          {!events.data?.length ? <p className="text-sm text-muted">Không có lịch trong 7 ngày tới.</p> : (
            <ul className="space-y-2 text-sm">
              {(events.data as any[]).map((e) => (
                <li key={e.id}><span className="font-medium">{e.title}</span><span className="block text-muted">{fmtDateTime(e.start_at)}{e.location ? ` · ${e.location}` : ""}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Hoạt động gần đây trong hệ thống">
          {!audit.data?.length ? <p className="text-sm text-muted">Chưa có hoạt động.</p> : (
            <ul className="space-y-2 text-sm">
              {(audit.data as any[]).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{actorName.get(a.actor_id) ?? "Hệ thống"}</span>{" "}
                    <span className="text-muted">{(ACTION[a.action] ?? a.action).toLowerCase()} · {ENTITY[a.entity] ?? a.entity}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fmtDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

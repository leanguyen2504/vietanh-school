import Link from "next/link";
import { Bell, BookOpen, ClipboardCheck, GraduationCap, ListChecks, UserSquare2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { can, PERMS, ROLE_LABELS } from "@/lib/roles";
import { addDays, fmtDate, fmtDateTime, todayVN } from "@/lib/format";
import { ATT_SESSION } from "@/lib/labels";
import { Alert, Badge, Card, DenyNotice, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("dashboard");
  if (ctx.role === "owner") redirect(sp.denied ? "/owner?denied=1" : "/owner");
  const { supabase, year, role } = ctx;
  const today = todayVN();

  if (!year) {
    return (
      <>
        <PageHeader title="Tổng quan" />
        <EmptyState title="Chưa có năm học" description="Quản trị viên cần tạo năm học trong mục Cấu hình." />
      </>
    );
  }

  const nowIso = new Date().toISOString();
  const weekLater = addDays(today, 7);
  const [summary, att, staffCount, anns, myTasks, pendingAnns, events, missingInfo] = await Promise.all([
    supabase.rpc("report_enrollment_summary", { p_year: year.id }),
    supabase.rpc("report_attendance_day", { p_year: year.id, p_date: today }),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("status", "working"),
    supabase.from("announcements").select("id, title, priority, published_at").in("status", ["published", "scheduled"]).or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .gte("published_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("published_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id, title, due_date, status").eq("assignee_id", ctx.userId).neq("status", "done")
      .lte("due_date", weekLater).order("due_date").limit(8),
    can(role, PERMS.approveAnnouncement)
      ? supabase.from("announcements").select("id, title, created_at").eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase.from("events").select("id, title, start_at, location").gte("start_at", nowIso)
      .lte("start_at", new Date(Date.now() + 7 * 864e5).toISOString()).order("start_at").limit(5),
    can(role, PERMS.manageStudents)
      ? supabase.from("students").select("id, code, full_name, date_of_birth, student_guardians(guardian_id)").eq("status", "studying").limit(500)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const firstError = [summary, att, staffCount, anns, myTasks].find((r) => r.error)?.error;
  const classes = (summary.data ?? []) as any[];
  const totalStudents = classes.reduce((s, c) => s + Number(c.student_count), 0);
  const attRows = (att.data ?? []) as any[];
  const recorded = attRows.reduce((s, r) => s + Number(r.total), 0);
  const present = attRows.reduce((s, r) => s + Number(r.present) + Number(r.late), 0);
  const notDone = attRows.filter((r) => r.session_status !== "confirmed");
  const incomplete = ((missingInfo.data ?? []) as any[]).filter((s) => !s.date_of_birth || !s.student_guardians?.length);
  const overdue = ((myTasks.data ?? []) as any[]).filter((t) => t.due_date && t.due_date < today);

  return (
    <>
      <PageHeader
        title={`Xin chào, ${ctx.fullName}`}
        description={`${ROLE_LABELS[role]} · Năm học ${year.name} · Hôm nay ${fmtDate(today)}${role === "teacher" ? " · Số liệu theo các lớp được phân công" : role === "head" ? " · Số liệu theo phạm vi tổ/bộ phận" : ""}`}
      />
      {sp.denied && <div className="mb-4"><DenyNotice /></div>}
      {firstError && <div className="mb-4"><Alert tone="danger">Một phần số liệu không tải được: {firstError.message}. Hãy tải lại trang.</Alert></div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Học sinh" value={totalStudents} hint="Đang ghi danh" icon={<GraduationCap className="h-5 w-5" />} href={can(role, PERMS.manageStudents) || role === "teacher" || role === "head" ? "/students" : undefined} />
        <StatCard label="Lớp học" value={classes.length} icon={<BookOpen className="h-5 w-5" />} href="/classes" />
        <StatCard label="Nhân sự" value={staffCount.count ?? 0} hint="Đang làm việc" icon={<UserSquare2 className="h-5 w-5" />} href="/staff" />
        <StatCard label="Chuyên cần hôm nay" value={recorded ? `${Math.round((present / recorded) * 100)}%` : "—"} hint={`${attRows.length - notDone.length}/${attRows.length} lớp đã xác nhận`} icon={<ClipboardCheck className="h-5 w-5" />} href={role === "board" ? "/reports" : "/attendance"} />
        <StatCard label="Thông báo mới" value={anns.data?.length ?? 0} hint="7 ngày qua" icon={<Bell className="h-5 w-5" />} href="/announcements" />
        <StatCard label="Việc sắp đến hạn" value={myTasks.data?.length ?? 0} hint={overdue.length ? `${overdue.length} việc quá hạn` : "Trong 7 ngày tới"} icon={<ListChecks className="h-5 w-5" />} href="/tasks" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Việc cần chú ý</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {role !== "board" && role !== "health" && (
          <Card title={`Lớp chưa hoàn tất điểm danh hôm nay (${notDone.length})`} actions={<Link className="link text-sm" href="/attendance">Điểm danh</Link>}>
            {notDone.length === 0 ? (
              <p className="text-sm text-muted">Tất cả các lớp trong phạm vi của bạn đã xác nhận điểm danh.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {notDone.map((c) => (
                  <li key={c.class_id}>
                    <Link href={`/attendance/take?class=${c.class_id}&date=${today}`}>
                      <Badge tone={c.session_status === "draft" ? "warning" : "danger"}>
                        {c.class_name} · {c.session_status === "draft" ? "Đang nháp" : "Chưa điểm danh"}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can(role, PERMS.approveAnnouncement) && (
          <Card title={`Thông báo chờ duyệt (${pendingAnns.data?.length ?? 0})`}>
            {!pendingAnns.data?.length ? <p className="text-sm text-muted">Không có thông báo chờ duyệt.</p> : (
              <ul className="space-y-2 text-sm">
                {pendingAnns.data.map((a: any) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <Link href={`/announcements/${a.id}`} className="link">{a.title}</Link>
                    <span className="shrink-0 text-muted">{fmtDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {can(role, PERMS.manageStudents) && (
          <Card title={`Hồ sơ học sinh thiếu thông tin (${incomplete.length})`}>
            {incomplete.length === 0 ? <p className="text-sm text-muted">Không có hồ sơ thiếu ngày sinh hoặc người giám hộ.</p> : (
              <ul className="space-y-1 text-sm">
                {incomplete.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <Link href={`/students/${s.id}`} className="link">{s.code} · {s.full_name}</Link>{" "}
                    <span className="text-muted">— thiếu {!s.date_of_birth ? "ngày sinh" : "người giám hộ"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Lịch sắp tới (7 ngày)" actions={<Link className="link text-sm" href="/events">Xem lịch</Link>}>
          {!events.data?.length ? <p className="text-sm text-muted">Không có lịch công tác trong 7 ngày tới.</p> : (
            <ul className="space-y-2 text-sm">
              {events.data.map((e: any) => (
                <li key={e.id}>
                  <span className="font-medium">{e.title}</span>
                  <span className="block text-muted">{fmtDateTime(e.start_at)}{e.location ? ` · ${e.location}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Việc của tôi" actions={<Link className="link text-sm" href="/tasks">Tất cả</Link>}>
          {!myTasks.data?.length ? <p className="text-sm text-muted">Không có việc đến hạn trong 7 ngày tới.</p> : (
            <ul className="space-y-2 text-sm">
              {myTasks.data.map((t: any) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <Link href={`/tasks/${t.id}`} className="link">{t.title}</Link>
                  <Badge tone={t.due_date < today ? "danger" : "warning"}>{t.due_date < today ? "Quá hạn" : "Hạn"} {fmtDate(t.due_date)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Thông báo mới" actions={<Link className="link text-sm" href="/announcements">Tất cả</Link>}>
          {!anns.data?.length ? <p className="text-sm text-muted">Chưa có thông báo mới.</p> : (
            <ul className="space-y-2 text-sm">
              {anns.data.map((a: any) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <Link href={`/announcements/${a.id}`} className="link">{a.title}</Link>
                  {a.priority !== "normal" && <Badge tone="danger">{a.priority === "urgent" ? "Khẩn" : "Quan trọng"}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">Buổi điểm danh mặc định: {ATT_SESSION.full_day}. Giờ hiển thị theo múi giờ Việt Nam.</p>
    </>
  );
}

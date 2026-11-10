import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { myClassIds } from "@/lib/queries";
import { fmtDate, fmtDateTime, todayVN } from "@/lib/format";
import { ATT_SESSION } from "@/lib/labels";
import { Alert, Badge, EmptyState, PageHeader, btn } from "@/components/ui";
import { TakeForm } from "./take-form";

type SP = { class?: string; date?: string; session?: string };

export default async function TakeAttendance({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireModule("attendance");
  const { supabase, year } = ctx;
  const today = todayVN();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const session = (["full_day", "morning", "afternoon"].includes(sp.session ?? "") ? sp.session : "full_day") as string;
  const mine = await myClassIds(ctx);

  if (!sp.class) {
    const { data: cls } = year ? await supabase.from("classes").select("id, name").eq("academic_year_id", year.id).eq("status", "active").order("name") : { data: [] };
    const list = (cls ?? []).filter((c: any) => ctx.role === "admin" || ctx.role === "principal" || mine.includes(c.id));
    return (
      <>
        <PageHeader title="Chọn lớp điểm danh" />
        {list.length === 0 ? <EmptyState title="Bạn chưa được phân công lớp nào" /> : (
          <div className="flex flex-wrap gap-2">{list.map((c: any) => <Link key={c.id} className={btn("secondary")} href={`?class=${c.id}&date=${date}`}>Lớp {c.name}</Link>)}</div>
        )}
      </>
    );
  }

  const { data: cls } = await supabase.from("classes").select("id, name, status").eq("id", sp.class).maybeSingle();
  if (!cls) return <EmptyState title="Không tìm thấy lớp hoặc bạn không có quyền xem lớp này" />;

  const [{ data: enr }, { data: sess }] = await Promise.all([
    supabase.from("enrollments").select("student_id, students(code, full_name)").eq("class_id", cls.id).eq("status", "active"),
    supabase.from("attendance_sessions").select("id, status, confirmed_at, updated_at, created_by_p:created_by(full_name), confirmed_by_p:confirmed_by(full_name), updated_by_p:updated_by(full_name)").eq("class_id", cls.id).eq("date", date).eq("session", session).maybeSingle(),
  ]);
  const { data: recs } = sess ? await supabase.from("attendance_records").select("student_id, status, reason").eq("session_id", sess.id) : { data: [] };
  const recMap = new Map((recs ?? []).map((r: any) => [r.student_id, r]));
  const students = ((enr ?? []) as any[])
    .filter((e) => e.students)
    .map((e) => ({ id: e.student_id, code: e.students.code, name: e.students.full_name, status: recMap.get(e.student_id)?.status ?? "present", reason: recMap.get(e.student_id)?.reason ?? "" }))
    .sort((a, b) => a.name.split(" ").pop()!.localeCompare(b.name.split(" ").pop()!, "vi") || a.name.localeCompare(b.name, "vi"));
  const canTake = ctx.role === "admin" || ctx.role === "principal" || mine.includes(cls.id);
  const s: any = sess;

  return (
    <>
      <Link href={`/attendance?date=${date}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Điểm danh</Link>
      <PageHeader
        title={`Điểm danh lớp ${cls.name}`}
        description={`${fmtDate(date)} · ${ATT_SESSION[session]}`}
        actions={s?.status === "confirmed" ? <Badge tone="success">✓ Đã xác nhận</Badge> : s ? <Badge tone="warning">● Bản nháp</Badge> : <Badge tone="danger">! Chưa điểm danh</Badge>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="class" value={cls.id} />
        <input type="date" name="date" defaultValue={date} max={today} className="input w-auto" aria-label="Ngày" />
        <select name="session" defaultValue={session} className="input w-auto" aria-label="Buổi">{Object.entries(ATT_SESSION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className={btn("secondary")}>Đổi</button>
      </form>
      {s && (
        <p className="mb-3 text-xs text-muted">
          Tạo bởi {s.created_by_p?.full_name ?? "—"} · Cập nhật lần cuối {fmtDateTime(s.updated_at)} bởi {s.updated_by_p?.full_name ?? "—"}
          {s.confirmed_at && ` · Xác nhận ${fmtDateTime(s.confirmed_at)} bởi ${s.confirmed_by_p?.full_name ?? "—"}`}
        </p>
      )}
      {!canTake && <div className="mb-3"><Alert tone="info">Bạn chỉ có quyền xem điểm danh lớp này.</Alert></div>}
      {students.length === 0 ? <EmptyState title="Lớp chưa có học sinh" /> : (
        <TakeForm classId={cls.id} date={date} session={session} students={students} confirmed={s?.status === "confirmed"} readOnly={!canTake} />
      )}
    </>
  );
}

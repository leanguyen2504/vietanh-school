import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { isReadOnlyYear } from "@/lib/queries";
import { CLASS_STATUS } from "@/lib/labels";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { createClass } from "./actions";

export default async function ClassesPage() {
  const ctx = await requireModule("classes");
  const { supabase, year } = ctx;
  if (!year) return <EmptyState title="Chưa có năm học" description="Tạo năm học trong mục Cấu hình." />;

  const [{ data: classes, error }, summary, { data: grades }, { data: staff }] = await Promise.all([
    supabase.from("classes").select("id, name, room, capacity, status, grade_id, grades(name, grade_number, school_levels(name, code, sort_order)), staff:homeroom_staff_id(full_name)").eq("academic_year_id", year.id),
    supabase.rpc("report_enrollment_summary", { p_year: year.id }),
    supabase.from("grades").select("id, name, grade_number, school_levels!inner(name, is_active)").eq("school_levels.is_active", true).order("grade_number"),
    supabase.from("staff").select("id, full_name").eq("status", "working").order("full_name"),
  ]);
  const counts = new Map(((summary.data ?? []) as any[]).map((r) => [r.class_id, Number(r.student_count)]));
  const list = ((classes ?? []) as any[]).sort((a, b) => a.grades.grade_number - b.grades.grade_number || a.name.localeCompare(b.name, "vi"));
  const byLevel = new Map<string, any[]>();
  list.forEach((c) => {
    const k = c.grades.school_levels.name;
    byLevel.set(k, [...(byLevel.get(k) ?? []), c]);
  });
  const canEdit = can(ctx.role, PERMS.manageClasses) && !isReadOnlyYear(ctx);

  return (
    <>
      <PageHeader title="Lớp học" description={`Năm học ${year.name} · ${list.length} lớp`} />
      {error && <Alert tone="danger">Không tải được danh sách lớp: {error.message}</Alert>}
      {canEdit && (
        <details className="mb-4 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium text-brand-dark">+ Tạo lớp mới</summary>
          <ActionForm action={createClass} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Tên lớp *"><input name="name" required className="input" placeholder="VD: 6A3" /></Field>
            <Field label="Khối *"><select name="grade_id" required className="input"><option value="">Chọn khối</option>{(grades ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.name} · {g.school_levels.name}</option>)}</select></Field>
            <Field label="Phòng học"><input name="room" className="input" /></Field>
            <Field label="Sĩ số tối đa"><input name="capacity" type="number" min={1} max={99} className="input" /></Field>
            <Field label="GV chủ nhiệm"><select name="homeroom_staff_id" className="input"><option value="">—</option>{(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
            <div><SubmitButton>Tạo lớp</SubmitButton></div>
          </ActionForm>
        </details>
      )}
      {list.length === 0 ? (
        <Card><EmptyState title="Chưa có lớp trong năm học này" description={canEdit ? "Tạo lớp mới hoặc sao chép cấu trúc từ năm trước trong mục Cấu hình." : "Bạn chưa được phân công lớp nào trong năm học này."} /></Card>
      ) : (
        <div className="space-y-6">
          {Array.from(byLevel.entries()).map(([level, items]) => (
            <section key={level}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{level}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((c) => {
                  const n = counts.get(c.id) ?? 0;
                  return (
                    <Link key={c.id} href={`/classes/${c.id}`} className="group rounded-xl border border-line bg-surface p-4 transition hover:border-brand/50 hover:shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-semibold group-hover:text-brand-dark">Lớp {c.name}</p>
                          <p className="text-xs text-muted">{c.grades.name}{c.room ? ` · Phòng ${c.room}` : ""}</p>
                        </div>
                        <Badge tone={c.status === "active" ? "success" : "neutral"}>{CLASS_STATUS[c.status]}</Badge>
                      </div>
                      <p className="mt-3 text-sm">GVCN: <span className="font-medium">{c.staff?.full_name ?? "Chưa phân công"}</span></p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                        <span className="font-semibold text-ink">{n}</span> học sinh{c.capacity ? ` / ${c.capacity}` : ""}
                      </div>
                      {c.capacity && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-page" aria-hidden>
                          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (n / c.capacity) * 100)}%` }} />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

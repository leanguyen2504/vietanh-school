import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { isReadOnlyYear } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { CLASS_STATUS } from "@/lib/labels";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, EmptyState, Field, PageHeader, TableWrap } from "@/components/ui";
import { addAssignment, removeAssignment, updateClass } from "../actions";

export default async function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireModule("classes");
  const { supabase } = ctx;
  const { data: c } = await supabase.from("classes").select("*, grades(name), academic_years(name, status), staff:homeroom_staff_id(full_name)").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: enr }, { data: ta }, { data: staff }] = await Promise.all([
    supabase.from("enrollments").select("student_id, start_date, students(id, code, full_name, date_of_birth, gender)").eq("class_id", id).eq("status", "active"),
    supabase.from("teaching_assignments").select("id, subject, is_homeroom, staff(full_name)").eq("class_id", id),
    supabase.from("staff").select("id, full_name").eq("status", "working").order("full_name"),
  ]);
  const students = ((enr ?? []) as any[]).filter((e) => e.students).sort((a, b) => a.students.full_name.localeCompare(b.students.full_name, "vi"));
  const yearLocked = ["locked", "archived"].includes(c.academic_years?.status);
  const canEdit = can(ctx.role, PERMS.manageClasses) && !yearLocked && !isReadOnlyYear(ctx);
  const canSeeStudents = ctx.role !== "board";

  return (
    <>
      <Link href="/classes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Lớp học</Link>
      <PageHeader
        title={`Lớp ${c.name}`}
        description={`${c.grades?.name} · Năm học ${c.academic_years?.name} · GVCN: ${c.staff?.full_name ?? "chưa phân công"}`}
        actions={
          <>
            <Badge tone={c.status === "active" ? "success" : "neutral"}>{CLASS_STATUS[c.status]}</Badge>
            {can(ctx.role, ["admin", "principal", "teacher", "head"]) && c.status === "active" && (
              <ButtonLink href={`/attendance/take?class=${c.id}`}><ClipboardCheck className="h-4 w-4" /> Điểm danh</ButtonLink>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Danh sách học sinh (${students.length}${c.capacity ? `/${c.capacity}` : ""})`} className="lg:col-span-2">
          {!canSeeStudents ? <p className="text-sm text-muted">Hội đồng trường xem số liệu tổng hợp trong mục Báo cáo.</p> : students.length === 0 ? <EmptyState title="Lớp chưa có học sinh" /> : (
            <TableWrap>
              <table className="table">
                <thead><tr><th>#</th><th>Mã HS</th><th>Họ tên</th><th>Ngày sinh</th></tr></thead>
                <tbody>
                  {students.map((e, i) => (
                    <tr key={e.student_id}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="font-mono text-xs">{e.students.code}</td>
                      <td>{can(ctx.role, ["admin", "principal", "office", "health", "teacher", "head"]) ? <Link className="link" href={`/students/${e.students.id}`}>{e.students.full_name}</Link> : e.students.full_name}</td>
                      <td>{fmtDate(e.students.date_of_birth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Phân công giảng dạy">
            <ul className="space-y-2 text-sm">
              {(ta ?? []).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span><span className="font-medium">{a.staff?.full_name}</span> <span className="text-muted">· {a.subject ?? "—"}</span> {a.is_homeroom && <Badge tone="brand">Chủ nhiệm</Badge>}</span>
                  {canEdit && !a.is_homeroom && <ActionButton action={removeAssignment} fields={{ id: a.id, class_id: c.id }} variant="ghost" confirm="Bỏ phân công này?">Bỏ</ActionButton>}
                </li>
              ))}
              {!ta?.length && <li className="text-muted">Chưa có phân công.</li>}
            </ul>
            {canEdit && (
              <ActionForm action={addAssignment} resetOnSuccess className="mt-3 space-y-2 border-t border-line pt-3">
                <input type="hidden" name="class_id" value={c.id} />
                <select name="staff_id" required className="input"><option value="">Chọn giáo viên</option>{(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                <input name="subject" required className="input" placeholder="Môn học" />
                <SubmitButton variant="secondary">Thêm phân công</SubmitButton>
              </ActionForm>
            )}
          </Card>
          {canEdit && (
            <Card title="Thông tin lớp">
              <ActionForm action={updateClass} className="space-y-3">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="grade_id" value={c.grade_id} />
                <Field label="Tên lớp"><input name="name" defaultValue={c.name} className="input" required /></Field>
                <Field label="Phòng học"><input name="room" defaultValue={c.room ?? ""} className="input" /></Field>
                <Field label="Sĩ số tối đa"><input name="capacity" type="number" defaultValue={c.capacity ?? ""} className="input" /></Field>
                <Field label="GV chủ nhiệm"><select name="homeroom_staff_id" defaultValue={c.homeroom_staff_id ?? ""} className="input"><option value="">—</option>{(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
                <Field label="Trạng thái"><select name="status" defaultValue={c.status} className="input">{Object.entries(CLASS_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <SubmitButton>Lưu</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

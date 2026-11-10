import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { classesForYear } from "@/lib/queries";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { GENDER, STUDENT_STATUS } from "@/lib/labels";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, Field, PageHeader } from "@/components/ui";
import { addGuardian, addNote, changeStudentStatus, removeGuardian, transferClass, updateStudent } from "../actions";

export default async function StudentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireModule("students");
  const { supabase } = ctx;
  const manage = can(ctx.role, PERMS.manageStudents);

  const { data: s } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();

  const [{ data: guardians }, { data: history }, notesRes, classes] = await Promise.all([
    supabase.from("student_guardians").select("relationship, is_primary, guardians(id, full_name, phone, email)").eq("student_id", id),
    supabase.from("enrollments").select("id, status, start_date, end_date, note, academic_years(name), classes(name)").eq("student_id", id).order("start_date", { ascending: false }),
    manage ? supabase.from("student_notes").select("id, content, created_at, profiles:created_by(full_name)").eq("student_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    manage ? classesForYear(ctx, { onlyActive: true }) : Promise.resolve([]),
  ]);
  const current = (history ?? []).find((h: any) => h.status === "active");

  return (
    <>
      <Link href="/students" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Danh sách học sinh</Link>
      <PageHeader
        title={s.full_name}
        description={`${s.code}${current ? ` · Lớp ${(current as any).classes?.name}` : " · Chưa xếp lớp năm học hiện tại"}`}
        actions={<Badge tone={s.status === "studying" ? "success" : "neutral"}>{STUDENT_STATUS[s.status]}</Badge>}
      />
      {sp.created && <div className="mb-4"><Alert tone="success">Đã tạo hồ sơ học sinh.</Alert></div>}
      {s.is_demo && <div className="mb-4"><Alert tone="info">Đây là hồ sơ DEMO hư cấu.</Alert></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Thông tin cơ bản">
            {manage ? (
              <ActionForm action={updateStudent} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={s.id} />
                <Field label="Mã học sinh"><input name="code" defaultValue={s.code} required className="input" /></Field>
                <Field label="Họ và tên"><input name="full_name" defaultValue={s.full_name} required className="input" /></Field>
                <Field label="Ngày sinh"><input type="date" name="date_of_birth" defaultValue={s.date_of_birth ?? ""} className="input" /></Field>
                <Field label="Giới tính">
                  <select name="gender" defaultValue={s.gender ?? ""} className="input"><option value="">—</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select>
                </Field>
                <Field label="Ngày nhập học"><input type="date" name="admission_date" defaultValue={s.admission_date ?? ""} className="input" /></Field>
                <div className="flex items-end"><SubmitButton>Lưu thay đổi</SubmitButton></div>
              </ActionForm>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Ngày sinh</dt><dd>{fmtDate(s.date_of_birth)}</dd></div>
                <div><dt className="text-muted">Giới tính</dt><dd>{GENDER[s.gender] ?? "—"}</dd></div>
                <div><dt className="text-muted">Ngày nhập học</dt><dd>{fmtDate(s.admission_date)}</dd></div>
              </dl>
            )}
          </Card>

          <Card title="Người giám hộ">
            {!guardians?.length ? <p className="text-sm text-muted">Chưa có người giám hộ.</p> : (
              <ul className="divide-y divide-line">
                {guardians.map((g: any) => (
                  <li key={g.guardians.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <span className="font-medium">{g.guardians.full_name}</span> <span className="text-muted">({g.relationship})</span>
                      {g.is_primary && <> <Badge tone="brand">Liên hệ chính</Badge></>}
                      <p className="text-muted">{[g.guardians.phone, g.guardians.email].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    {manage && (
                      <ActionButton action={removeGuardian} fields={{ student_id: s.id, guardian_id: g.guardians.id }} variant="ghost" confirm="Gỡ liên kết người giám hộ này?">Gỡ</ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {manage && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-brand-dark">+ Thêm người giám hộ</summary>
                <ActionForm action={addGuardian} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={s.id} />
                  <Field label="Họ tên"><input name="g_name" required className="input" /></Field>
                  <Field label="Quan hệ"><input name="g_relationship" className="input" placeholder="Bố, Mẹ…" /></Field>
                  <Field label="Điện thoại"><input name="g_phone" className="input" inputMode="tel" /></Field>
                  <Field label="Email"><input name="g_email" type="email" className="input" /></Field>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_primary" /> Người liên hệ chính</label>
                  <div><SubmitButton>Thêm</SubmitButton></div>
                </ActionForm>
              </details>
            )}
          </Card>

          <Card title="Lịch sử lớp / năm học">
            {!history?.length ? <p className="text-sm text-muted">Chưa có lịch sử ghi danh.</p> : (
              <ol className="space-y-2 text-sm">
                {history.map((h: any) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={h.status === "active" ? "success" : "neutral"}>{h.status === "active" ? "Đang học" : h.status === "moved" ? "Đã chuyển lớp" : "Kết thúc"}</Badge>
                    <span>Năm {h.academic_years?.name} · Lớp <strong>{h.classes?.name}</strong></span>
                    <span className="text-muted">{fmtDate(h.start_date)} → {h.end_date ? fmtDate(h.end_date) : "nay"}</span>
                    {h.note && <span className="text-muted">· {h.note}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {manage && (
          <div className="space-y-4">
            <Card title="Xếp / chuyển lớp">
              <ActionForm action={transferClass} className="space-y-3">
                <input type="hidden" name="id" value={s.id} />
                <Field label="Lớp mới"><select name="class_id" required className="input"><option value="">Chọn lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Ghi chú"><input name="note" className="input" maxLength={200} /></Field>
                <SubmitButton variant="secondary">Xác nhận chuyển lớp</SubmitButton>
              </ActionForm>
            </Card>
            <Card title="Trạng thái học tập">
              <ActionForm action={changeStudentStatus} className="space-y-3" confirm="Xác nhận thay đổi trạng thái học tập?">
                <input type="hidden" name="id" value={s.id} />
                <Field label="Trạng thái"><select name="status" defaultValue={s.status} className="input">{Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Ngày hiệu lực"><input type="date" name="leave_date" className="input" /></Field>
                <Field label="Lý do / ghi chú"><input name="note" className="input" maxLength={500} /></Field>
                <SubmitButton variant="secondary">Cập nhật trạng thái</SubmitButton>
              </ActionForm>
              <p className="mt-2 text-xs text-muted">Hồ sơ không bị xóa; khi chuyển đi/thôi học, ghi danh hiện tại được kết thúc và lưu lịch sử.</p>
            </Card>
            <Card title="Ghi chú hành chính">
              <p className="mb-2 text-xs text-muted">Chỉ Ban Giám hiệu, văn phòng và quản trị viên xem được.</p>
              <ActionForm action={addNote} resetOnSuccess className="space-y-2">
                <input type="hidden" name="id" value={s.id} />
                <textarea name="content" rows={2} className="input" required maxLength={2000} />
                <SubmitButton variant="secondary">Thêm ghi chú</SubmitButton>
              </ActionForm>
              <ul className="mt-3 space-y-2 text-sm">
                {(notesRes.data ?? []).map((n: any) => (
                  <li key={n.id} className="rounded-lg bg-page p-2">
                    <p>{n.content}</p>
                    <p className="mt-1 text-xs text-muted">{n.profiles?.full_name ?? "—"} · {fmtDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

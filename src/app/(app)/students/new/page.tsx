import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { classesForYear } from "@/lib/queries";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { createStudent } from "../actions";

export default async function NewStudent() {
  const ctx = await requireModule("students");
  if (!can(ctx.role, PERMS.manageStudents)) redirect("/students");
  const classes = await classesForYear(ctx, { onlyActive: true });
  return (
    <>
      <PageHeader title="Thêm học sinh" description={`Ghi danh vào năm học ${ctx.year?.name ?? ""}. Chỉ nhập các thông tin nhà trường thực sự cần.`} />
      <ActionForm action={createStudent} className="space-y-4">
        <Card title="Thông tin học sinh">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã học sinh *" hint="Quy tắc mã cần nhà trường xác nhận"><input name="code" required className="input" maxLength={30} /></Field>
            <Field label="Họ và tên *"><input name="full_name" required className="input" maxLength={120} /></Field>
            <Field label="Ngày sinh"><input type="date" name="date_of_birth" className="input" /></Field>
            <Field label="Giới tính">
              <select name="gender" className="input"><option value="">—</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select>
            </Field>
            <Field label="Lớp">
              <select name="class_id" className="input"><option value="">Chưa xếp lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.grade_name})</option>)}</select>
            </Field>
            <Field label="Ngày nhập học"><input type="date" name="admission_date" className="input" /></Field>
          </div>
        </Card>
        <Card title="Người liên hệ chính">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên"><input name="g_name" className="input" maxLength={120} /></Field>
            <Field label="Quan hệ"><input name="g_relationship" className="input" placeholder="Bố, Mẹ, Ông, Bà…" maxLength={40} /></Field>
            <Field label="Điện thoại"><input name="g_phone" className="input" inputMode="tel" maxLength={20} /></Field>
            <Field label="Email"><input type="email" name="g_email" className="input" /></Field>
          </div>
        </Card>
        <SubmitButton>Lưu học sinh</SubmitButton>
      </ActionForm>
    </>
  );
}

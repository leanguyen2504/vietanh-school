import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { STAFF_STATUS } from "@/lib/labels";
import { saveStaff } from "./actions";

export function StaffForm({ s, departments }: { s?: any; departments: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveStaff} resetOnSuccess={!s} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Mã nhân sự *"><input name="code" defaultValue={s?.code} required className="input" /></Field>
      <Field label="Họ và tên *"><input name="full_name" defaultValue={s?.full_name} required className="input" /></Field>
      <Field label="Email công vụ"><input name="work_email" type="email" defaultValue={s?.work_email ?? ""} className="input" /></Field>
      <Field label="Điện thoại công vụ"><input name="work_phone" defaultValue={s?.work_phone ?? ""} className="input" inputMode="tel" /></Field>
      <Field label="Tổ / bộ phận">
        <select name="department_id" defaultValue={s?.department_id ?? ""} className="input"><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </Field>
      <Field label="Chức vụ"><input name="position" defaultValue={s?.position ?? ""} className="input" /></Field>
      <Field label="Trạng thái">
        <select name="status" defaultValue={s?.status ?? "working"} className="input">{Object.entries(STAFF_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <div className="flex items-end"><SubmitButton>{s ? "Lưu" : "Thêm nhân sự"}</SubmitButton></div>
    </ActionForm>
  );
}

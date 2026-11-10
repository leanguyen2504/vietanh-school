import { getCtx } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader } from "@/components/ui";
import { updatePassword } from "@/app/(auth)/actions";

export default async function AccountPage() {
  const ctx = await getCtx();
  return (
    <>
      <PageHeader title="Tài khoản của tôi" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Thông tin">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">Họ tên</dt><dd>{ctx.fullName}</dd></div>
            <div><dt className="text-muted">Email</dt><dd>{ctx.email}</dd></div>
            <div><dt className="text-muted">Vai trò</dt><dd>{ROLE_LABELS[ctx.role]}</dd></div>
            <div><dt className="text-muted">Tổ / bộ phận</dt><dd>{ctx.departmentName ?? "—"}</dd></div>
            <div><dt className="text-muted">Năm học đang chọn</dt><dd>{ctx.year?.name ?? "—"}</dd></div>
          </dl>
        </Card>
        <Card title="Đổi mật khẩu">
          <ActionForm action={updatePassword} resetOnSuccess className="space-y-3">
            <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự"><input type="password" name="password" required minLength={8} autoComplete="new-password" className="input" /></Field>
            <Field label="Nhập lại mật khẩu"><input type="password" name="password2" required autoComplete="new-password" className="input" /></Field>
            <SubmitButton>Đổi mật khẩu</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

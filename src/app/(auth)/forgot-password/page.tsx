import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { forgotPassword } from "../actions";

export default function ForgotPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Quên mật khẩu</h1>
      <p className="mb-4 text-sm text-muted">Nhập email tài khoản, hệ thống sẽ gửi liên kết đặt lại mật khẩu.</p>
      <ActionForm action={forgotPassword} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" name="email" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Đang gửi…">Gửi liên kết</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">Quay lại đăng nhập</Link>
      </p>
    </>
  );
}

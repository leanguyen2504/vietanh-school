import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { SchoolMark } from "@/components/brand";
import { updatePassword } from "@/app/(auth)/actions";

export default function ResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <div className="mb-4"><SchoolMark /></div>
        <h1 className="mb-4 text-lg font-semibold">Đặt mật khẩu mới</h1>
        <ActionForm action={updatePassword} className="space-y-4" resetOnSuccess>
          <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự">
            <input className="input" type="password" name="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Nhập lại mật khẩu">
            <input className="input" type="password" name="password2" autoComplete="new-password" required />
          </Field>
          <SubmitButton className="w-full">Lưu mật khẩu</SubmitButton>
        </ActionForm>
        <p className="mt-4 text-center text-sm"><Link className="link" href="/">Vào trang tổng quan</Link></p>
      </div>
    </main>
  );
}

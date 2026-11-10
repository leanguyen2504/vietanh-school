import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Đăng nhập</h1>
      <ActionForm action={signIn} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" name="email" autoComplete="username" required />
        </Field>
        <Field label="Mật khẩu">
          <input className="input" type="password" name="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Đang đăng nhập…">Đăng nhập</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="link">Quên mật khẩu?</Link>
      </p>
    </>
  );
}

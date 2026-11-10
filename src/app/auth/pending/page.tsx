import { SchoolMark } from "@/components/brand";
import { btn } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";

export default function PendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <div className="mb-4 flex justify-center"><SchoolMark /></div>
        <h1 className="text-lg font-semibold">Tài khoản chưa được kích hoạt</h1>
        <p className="mt-2 text-sm text-muted">
          Tài khoản của bạn chưa được quản trị viên cấp vai trò hoặc đang bị khóa. Vui lòng liên hệ quản trị hệ thống của nhà trường.
        </p>
        <form action={signOut} className="mt-4">
          <button className={btn("secondary")}>Đăng xuất</button>
        </form>
      </div>
    </main>
  );
}

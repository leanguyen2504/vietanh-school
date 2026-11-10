import { CalendarDays, ClipboardCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { SchoolLogo, SchoolMark } from "@/components/brand";

const FEATURES = [
  { icon: GraduationCap, text: "Hồ sơ học sinh, lớp học theo năm học" },
  { icon: ClipboardCheck, text: "Điểm danh nhanh trên điện thoại" },
  { icon: CalendarDays, text: "Lịch công tác, thông báo, công việc" },
  { icon: ShieldCheck, text: "Phân quyền theo vai trò, bảo vệ dữ liệu học sinh" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand to-brand-dark p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="rounded-full bg-white p-1 shadow-sm"><SchoolLogo size={56} /></span>
          <div>
            <p className="font-semibold">Trường Tiểu học & THCS Việt Anh</p>
            <p className="text-sm text-white/80">Hải Phòng</p>
          </div>
        </div>
        <div className="relative">
          <span className="mb-8 inline-flex rounded-full bg-white p-2 shadow-lg ring-4 ring-white/20"><SchoolLogo size={112} /></span>
          <h1 className="text-3xl font-semibold leading-tight">Cổng quản trị nội bộ</h1>
          <p className="mt-3 max-w-md text-white/85">Một nơi để Ban Giám hiệu, giáo viên và văn phòng cùng quản lý công việc hằng ngày của nhà trường.</p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" aria-hidden /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">Chỉ dành cho cán bộ, giáo viên, nhân viên được nhà trường cấp tài khoản.</p>
      </section>
      <section className="flex items-center justify-center bg-page p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center lg:hidden"><SchoolMark size="lg" /></div>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
          <p className="mt-4 text-center text-xs text-muted lg:hidden">Chỉ dành cho cán bộ, giáo viên, nhân viên được nhà trường cấp tài khoản.</p>
        </div>
      </section>
    </main>
  );
}

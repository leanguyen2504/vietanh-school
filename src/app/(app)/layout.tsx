import Link from "next/link";
import { LogOut, UserCircle2 } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { MODULE_ACCESS, ROLE_LABELS, can, type ModuleKey } from "@/lib/roles";
import { Sidebar, YearSelect, type NavItem } from "@/components/nav";
import { Badge } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";
import { chooseYear } from "./shell-actions";

const NAV: { key: ModuleKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/", label: "Tổng quan" },
  { key: "students", href: "/students", label: "Học sinh" },
  { key: "classes", href: "/classes", label: "Lớp học" },
  { key: "staff", href: "/staff", label: "Nhân sự" },
  { key: "attendance", href: "/attendance", label: "Điểm danh" },
  { key: "events", href: "/events", label: "Lịch công tác" },
  { key: "announcements", href: "/announcements", label: "Thông báo" },
  { key: "tasks", href: "/tasks", label: "Công việc" },
  { key: "documents", href: "/documents", label: "Tài liệu" },
  { key: "menus", href: "/menus", label: "Thực đơn" },
  { key: "reports", href: "/reports", label: "Báo cáo" },
  { key: "settings", href: "/settings", label: "Cấu hình" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const items: NavItem[] = NAV.filter((n) => can(ctx.role, MODULE_ACCESS[n.key])) as NavItem[];
  const readOnly = ctx.year && ctx.year.status !== "active" && ctx.year.status !== "draft";

  return (
    <div className="min-h-screen">
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
          <Sidebar items={items} />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {ctx.years.length > 0 && <YearSelect years={ctx.years} current={ctx.year?.id} action={chooseYear} />}
            {readOnly && <Badge tone="warning">Năm học chỉ đọc</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/account" className="hidden items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-page sm:flex">
              <UserCircle2 className="h-5 w-5 text-muted" aria-hidden />
              <span className="text-left leading-tight">
                <span className="block font-medium">{ctx.fullName}</span>
                <span className="block text-xs text-muted">
                  {ROLE_LABELS[ctx.role]}{ctx.departmentName ? ` · ${ctx.departmentName}` : ""}
                </span>
              </span>
            </Link>
            <form action={signOut}>
              <button className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-page hover:text-ink" title="Đăng xuất">
                <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

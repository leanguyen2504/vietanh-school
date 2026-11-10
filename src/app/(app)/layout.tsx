import Link from "next/link";
import { Bell, LogOut, Search, UserCircle2 } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { MODULE_ACCESS, ROLE_LABELS, can, type ModuleKey } from "@/lib/roles";
import { Sidebar, YearSelect, type NavGroup, type NavItem } from "@/components/nav";
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
  { key: "finance", href: "/finance", label: "Tài chính" },
  { key: "reports", href: "/reports", label: "Báo cáo" },
  { key: "settings", href: "/settings", label: "Cấu hình" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  const isOwner = ctx.role === "owner";
  const allowed = NAV.filter((n) => can(ctx.role, MODULE_ACCESS[n.key])) as NavItem[];
  const groups: NavGroup[] = isOwner
    ? [
        {
          title: "Chủ đầu tư",
          highlight: true,
          items: [
            { key: "owner", href: "/owner", label: "Tổng quan điều hành" },
            { key: "finance", href: "/finance", label: "Tài chính" },
          ],
        },
        { title: "Nghiệp vụ nhà trường", items: allowed.filter((i) => i.key !== "dashboard" && i.key !== "finance") },
      ]
    : [{ items: allowed }];
  const readOnly = ctx.year && ctx.year.status !== "active" && ctx.year.status !== "draft";
  const { count: unread } = await ctx.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);

  return (
    <div className="min-h-screen">
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
          <Sidebar groups={groups} />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {ctx.years.length > 0 && <YearSelect years={ctx.years} current={ctx.year?.id} action={chooseYear} />}
            {readOnly && <Badge tone="warning">Năm học chỉ đọc</Badge>}
            <form action="/search" method="get" role="search" className="relative order-last w-full sm:order-none sm:ml-2 sm:w-72 lg:w-80">
              <label htmlFor="global-search" className="sr-only">Tìm kiếm</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder="Tìm học sinh, nhân sự, lớp, thông báo…"
                className="w-full rounded-lg border border-line bg-page py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
              />
            </form>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/notifications" className="relative rounded-lg p-2 text-muted hover:bg-page hover:text-ink" aria-label={`Thông báo hệ thống${unread ? `, ${unread} chưa đọc` : ""}`}>
              <Bell className="h-5 w-5" aria-hidden />
              {!!unread && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
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

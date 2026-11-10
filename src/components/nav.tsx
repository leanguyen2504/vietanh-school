"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  BarChart3, Bell, BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap, LayoutDashboard,
  ListChecks, Menu, Settings, UserSquare2, Utensils, X,
} from "lucide-react";
import { SchoolMark } from "@/components/brand";

const ICONS = {
  dashboard: LayoutDashboard, students: GraduationCap, classes: BookOpen, staff: UserSquare2,
  attendance: ClipboardCheck, events: CalendarDays, announcements: Bell, tasks: ListChecks,
  documents: FileText, menus: Utensils, reports: BarChart3, settings: Settings,
};

export type NavItem = { key: keyof typeof ICONS; href: string; label: string };

export function Sidebar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const list = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Điều hướng chính">
      {items.map((it) => {
        const Icon = ICONS[it.key];
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link
            key={it.key}
            href={it.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-page hover:text-ink",
            )}
          >
            <Icon className={clsx("h-4 w-4", active && "text-brand")} aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <button className="rounded-lg p-2 text-ink hover:bg-page lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu">
        <Menu className="h-5 w-5" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        <div className="border-b border-line px-4 py-3"><SchoolMark /></div>
        {list}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <SchoolMark />
              <button onClick={() => setOpen(false)} aria-label="Đóng menu" className="rounded p-1 hover:bg-page"><X className="h-5 w-5" /></button>
            </div>
            {list}
          </aside>
        </div>
      )}
    </>
  );
}

export function YearSelect({ years, current, action }: { years: { id: string; name: string; status: string }[]; current?: string; action: (fd: FormData) => void }) {
  return (
    <form action={action}>
      <label className="sr-only" htmlFor="year_id">Năm học</label>
      <select
        id="year_id"
        name="year_id"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            Năm học {y.name}{y.status === "active" ? " (hiện tại)" : y.status === "locked" || y.status === "archived" ? " (chỉ đọc)" : y.status === "draft" ? " (nháp)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}

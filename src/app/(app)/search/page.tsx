import Link from "next/link";
import { Bell, BookOpen, CalendarDays, FileText, GraduationCap, ListChecks, UserSquare2, Wallet } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { can, MODULE_ACCESS, type ModuleKey } from "@/lib/roles";
import { cleanSearch } from "@/lib/queries";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";

type Hit = { id: string; href: string; title: string; sub?: string };
type Group = { key: ModuleKey; label: string; icon: React.ReactNode; hits: Hit[]; more: string };

const LIMIT = 8;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const ctx = await getCtx();
  const { supabase, role, year } = ctx;
  const q = cleanSearch(sp.q);
  const like = `%${q}%`;
  const allow = (m: ModuleKey) => can(role, MODULE_ACCESS[m]);
  const none = Promise.resolve({ data: [] as any[] });

  if (q.length < 2) {
    return (
      <>
        <PageHeader title="Tìm kiếm" description="Gõ ít nhất 2 ký tự vào ô tìm kiếm ở đầu trang." />
        <SearchBox q={q} />
      </>
    );
  }

  const [students, staff, classes, anns, events, tasks, docs, fin] = await Promise.all([
    allow("students") ? supabase.from("students").select("id, code, full_name, date_of_birth, status").or(`full_name.ilike.${like},code.ilike.${like}`).order("full_name").limit(LIMIT) : none,
    allow("staff") ? supabase.from("staff").select("id, code, full_name, position, departments(name)").or(`full_name.ilike.${like},code.ilike.${like}`).order("full_name").limit(LIMIT) : none,
    allow("classes") && year ? supabase.from("classes").select("id, name, grades(name)").eq("academic_year_id", year.id).ilike("name", like).order("name").limit(LIMIT) : none,
    allow("announcements") ? supabase.from("announcements").select("id, title, status, created_at").ilike("title", like).order("created_at", { ascending: false }).limit(LIMIT) : none,
    allow("events") ? supabase.from("events").select("id, title, start_at, location").ilike("title", like).order("start_at", { ascending: false }).limit(LIMIT) : none,
    allow("tasks") ? supabase.from("tasks").select("id, title, due_date, status").ilike("title", like).order("created_at", { ascending: false }).limit(LIMIT) : none,
    allow("documents") ? supabase.from("documents").select("id, title, doc_type, created_at").ilike("title", like).order("created_at", { ascending: false }).limit(LIMIT) : none,
    allow("finance") ? supabase.from("finance_entries").select("id, entry_date, kind, amount, description").ilike("description", like).order("entry_date", { ascending: false }).limit(LIMIT) : none,
  ]);

  const enc = encodeURIComponent(q);
  const all: Group[] = [
    { key: "students" as ModuleKey, label: "Học sinh", icon: <GraduationCap className="h-4 w-4" />, more: `/students?q=${enc}`,
      hits: ((students.data ?? []) as any[]).map((s) => ({ id: s.id, href: `/students/${s.id}`, title: `${s.full_name}`, sub: `${s.code}${s.date_of_birth ? ` · ${fmtDate(s.date_of_birth)}` : ""}` })) },
    { key: "staff" as ModuleKey, label: "Nhân sự", icon: <UserSquare2 className="h-4 w-4" />, more: `/staff?q=${enc}`,
      hits: ((staff.data ?? []) as any[]).map((s) => ({ id: s.id, href: `/staff/${s.id}`, title: s.full_name, sub: [s.code, s.position, s.departments?.name].filter(Boolean).join(" · ") })) },
    { key: "classes" as ModuleKey, label: "Lớp học", icon: <BookOpen className="h-4 w-4" />, more: "/classes",
      hits: ((classes.data ?? []) as any[]).map((c) => ({ id: c.id, href: `/classes/${c.id}`, title: `Lớp ${c.name}`, sub: c.grades?.name })) },
    { key: "announcements" as ModuleKey, label: "Thông báo", icon: <Bell className="h-4 w-4" />, more: "/announcements",
      hits: ((anns.data ?? []) as any[]).map((a) => ({ id: a.id, href: `/announcements/${a.id}`, title: a.title, sub: fmtDate(a.created_at) })) },
    { key: "events" as ModuleKey, label: "Lịch công tác", icon: <CalendarDays className="h-4 w-4" />, more: "/events",
      hits: ((events.data ?? []) as any[]).map((e) => ({ id: e.id, href: `/events?d=${String(e.start_at).slice(0, 10)}`, title: e.title, sub: `${fmtDateTime(e.start_at)}${e.location ? ` · ${e.location}` : ""}` })) },
    { key: "tasks" as ModuleKey, label: "Công việc", icon: <ListChecks className="h-4 w-4" />, more: "/tasks",
      hits: ((tasks.data ?? []) as any[]).map((t) => ({ id: t.id, href: `/tasks/${t.id}`, title: t.title, sub: t.due_date ? `Hạn ${fmtDate(t.due_date)}` : undefined })) },
    { key: "documents" as ModuleKey, label: "Tài liệu", icon: <FileText className="h-4 w-4" />, more: "/documents",
      hits: ((docs.data ?? []) as any[]).map((d) => ({ id: d.id, href: `/api/files/document/${d.id}`, title: d.title, sub: `${d.doc_type} · ${fmtDate(d.created_at)}` })) },
    { key: "finance" as ModuleKey, label: "Thu/chi", icon: <Wallet className="h-4 w-4" />, more: `/finance?q=${enc}&status=approved#so-thu-chi`,
      hits: ((fin.data ?? []) as any[]).map((f) => ({ id: f.id, href: `/finance?q=${enc}&status=approved#so-thu-chi`, title: f.description ?? "(không có nội dung)", sub: `${fmtDate(f.entry_date)} · ${f.kind === "income" ? "Thu" : "Chi"} ${fmtMoney(Number(f.amount))}` })) },
  ];
  const groups = all.filter((g) => allow(g.key));
  const total = groups.reduce((s, g) => s + g.hits.length, 0);

  return (
    <>
      <PageHeader title={`Kết quả tìm kiếm “${q}”`} description={total ? `Tìm thấy ${total} kết quả trong phạm vi bạn được xem.` : undefined} />
      <SearchBox q={q} />
      {!total ? (
        <EmptyState title="Không tìm thấy kết quả" description="Thử từ khóa khác, ví dụ một phần họ tên, mã học sinh hoặc tên lớp." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.filter((g) => g.hits.length).map((g) => (
            <Card key={g.key} title={<span className="flex items-center gap-2"><span className="text-brand">{g.icon}</span>{g.label} ({g.hits.length}{g.hits.length === LIMIT ? "+" : ""})</span>}
              actions={g.hits.length === LIMIT ? <Link href={g.more} className="link text-sm">Xem thêm</Link> : undefined}>
              <ul className="divide-y divide-line">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="block rounded px-1 py-2 hover:bg-page">
                      <span className="block text-sm font-medium text-ink">{h.title}</span>
                      {h.sub && <span className="block text-xs text-muted">{h.sub}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/search" method="get" className="mb-6 flex gap-2 sm:hidden">
      <input name="q" type="search" defaultValue={q} className="input" placeholder="Tìm kiếm…" aria-label="Tìm kiếm" />
      <button className="rounded-lg bg-brand px-4 text-sm font-medium text-white">Tìm</button>
    </form>
  );
}

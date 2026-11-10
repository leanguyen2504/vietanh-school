import Link from "next/link";
import clsx from "clsx";
import { MapPin, User, Users } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { addDays, fmtTime, mondayOf, todayVN, TZ } from "@/lib/format";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Card, Field, PageHeader, btn } from "@/components/ui";
import { deleteEvent, saveEvent } from "./actions";

const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const vnDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string; d?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("events");
  const view = sp.view === "month" ? "month" : "week";
  const base = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayVN();
  const today = todayVN();

  let start: string, days: number, prev: string, next: string, title: string;
  if (view === "week") {
    start = mondayOf(base); days = 7; prev = addDays(start, -7); next = addDays(start, 7);
    title = `Tuần ${start.slice(8, 10)}/${start.slice(5, 7)} – ${addDays(start, 6).slice(8, 10)}/${addDays(start, 6).slice(5, 7)}/${addDays(start, 6).slice(0, 4)}`;
  } else {
    const first = base.slice(0, 8) + "01";
    start = mondayOf(first);
    const nextMonth = new Date(Date.UTC(+base.slice(0, 4), +base.slice(5, 7), 1)).toISOString().slice(0, 10);
    const lastDay = addDays(nextMonth, -1);
    days = Math.ceil(((new Date(lastDay).getTime() - new Date(start).getTime()) / 864e5 + 1) / 7) * 7;
    prev = new Date(Date.UTC(+base.slice(0, 4), +base.slice(5, 7) - 2, 1)).toISOString().slice(0, 10);
    next = nextMonth;
    title = `Tháng ${base.slice(5, 7)}/${base.slice(0, 4)}`;
  }
  const end = addDays(start, days);

  const [{ data: events, error }, { data: staff }, { data: docs }] = await Promise.all([
    ctx.supabase.from("events").select("id, title, description, start_at, end_at, location, participants, created_by, document_id, staff:owner_staff_id(full_name)")
      .gte("start_at", new Date(start + "T00:00:00+07:00").toISOString()).lt("start_at", new Date(end + "T00:00:00+07:00").toISOString()).order("start_at"),
    ctx.supabase.from("staff").select("id, full_name").eq("status", "working").order("full_name"),
    ctx.supabase.from("documents").select("id, title").order("created_at", { ascending: false }).limit(50),
  ]);
  const byDay = new Map<string, any[]>();
  (events ?? []).forEach((e: any) => { const k = vnDate(e.start_at); byDay.set(k, [...(byDay.get(k) ?? []), e]); });
  const manage = can(ctx.role, PERMS.manageEvents);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const month = base.slice(0, 7);

  return (
    <>
      <PageHeader title="Lịch công tác" description="Giờ hiển thị theo múi giờ Việt Nam." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link className={btn("secondary")} href={`?view=${view}&d=${prev}`} aria-label="Trước">‹</Link>
        <Link className={btn("secondary")} href={`?view=${view}`}>Hôm nay</Link>
        <Link className={btn("secondary")} href={`?view=${view}&d=${next}`} aria-label="Sau">›</Link>
        <h2 className="ml-2 font-semibold">{title}</h2>
        <div className="ml-auto flex rounded-lg border border-line bg-white p-0.5 text-sm">
          <Link href={`?view=week&d=${base}`} className={clsx("rounded-md px-3 py-1", view === "week" ? "bg-brand text-white" : "text-muted")}>Tuần</Link>
          <Link href={`?view=month&d=${base}`} className={clsx("rounded-md px-3 py-1", view === "month" ? "bg-brand text-white" : "text-muted")}>Tháng</Link>
        </div>
      </div>
      {error && <Alert tone="danger">Không tải được lịch: {error.message}</Alert>}

      {view === "week" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {dates.map((d, i) => (
            <div key={d} className={clsx("min-h-32 rounded-xl border bg-surface p-2", d === today ? "border-brand" : "border-line")}>
              <p className={clsx("mb-2 text-sm font-semibold", d === today && "text-brand-dark")}>{DOW[i]} · {d.slice(8, 10)}/{d.slice(5, 7)}</p>
              <ul className="space-y-2">
                {(byDay.get(d) ?? []).map((e) => (
                  <li key={e.id} className="rounded-lg border-l-4 border-brand bg-brand-soft/60 p-2 text-xs">
                    <p className="font-semibold text-ink">{fmtTime(e.start_at)}{e.end_at ? `–${fmtTime(e.end_at)}` : ""}</p>
                    <p className="font-medium">{e.title}</p>
                    {e.location && <p className="mt-1 flex items-center gap-1 text-muted"><MapPin className="h-3 w-3" />{e.location}</p>}
                    {e.staff?.full_name && <p className="flex items-center gap-1 text-muted"><User className="h-3 w-3" />{e.staff.full_name}</p>}
                    {e.participants && <p className="flex items-center gap-1 text-muted"><Users className="h-3 w-3" />{e.participants}</p>}
                    {e.document_id && <a className="link" href={`/api/files/document/${e.document_id}`}>Tài liệu</a>}
                    {manage && (can(ctx.role, ["admin", "principal"]) || e.created_by === ctx.userId) && (
                      <div className="mt-1"><ActionButton action={deleteEvent} fields={{ id: e.id }} variant="ghost" confirm="Xóa lịch này?">Xóa</ActionButton></div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {DOW.map((d) => <div key={d} className="bg-page p-2 text-center text-xs font-semibold text-muted">{d}</div>)}
            {dates.map((d) => (
              <div key={d} className={clsx("min-h-24 bg-surface p-1.5", d.slice(0, 7) !== month && "bg-page/60 text-muted")}>
                <p className={clsx("text-xs font-semibold", d === today && "inline-block rounded-full bg-brand px-1.5 text-white")}>{+d.slice(8, 10)}</p>
                {(byDay.get(d) ?? []).map((e) => (
                  <p key={e.id} className="mt-1 truncate rounded bg-brand-soft px-1 text-[11px] text-brand-dark" title={e.title}>{fmtTime(e.start_at)} {e.title}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {manage && (
        <Card title="Thêm lịch công tác" className="mt-6">
          <ActionForm action={saveEvent} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nội dung *" className="sm:col-span-2"><input name="title" required className="input" /></Field>
            <Field label="Bắt đầu *"><input type="datetime-local" name="start_at" required className="input" /></Field>
            <Field label="Kết thúc"><input type="datetime-local" name="end_at" className="input" /></Field>
            <Field label="Địa điểm"><input name="location" className="input" /></Field>
            <Field label="Người phụ trách"><select name="owner_staff_id" className="input"><option value="">—</option>{(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
            <Field label="Thành phần tham gia"><input name="participants" className="input" placeholder="VD: Tổ THCS" /></Field>
            <Field label="Tài liệu liên quan"><select name="document_id" className="input"><option value="">—</option>{(docs ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
            <Field label="Ghi chú" className="sm:col-span-2 lg:col-span-3"><input name="description" className="input" /></Field>
            <div className="flex items-end"><SubmitButton>Thêm lịch</SubmitButton></div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}

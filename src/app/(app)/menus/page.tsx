import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { addDays, fmtDate, fmtDateTime, mondayOf, todayVN, WEEKDAYS } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, btn } from "@/components/ui";
import { saveMenu } from "./actions";

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("menus");
  const week = mondayOf(sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w) ? sp.w : todayVN());
  const { data: m } = await ctx.supabase.from("menus").select("*, publisher:published_by(full_name)").eq("week_start", week).maybeSingle();
  const edit = can(ctx.role, PERMS.editMenus);
  const publish = can(ctx.role, PERMS.publishMenus);
  const items = (m?.items ?? {}) as Record<string, string>;

  return (
    <>
      <PageHeader title="Thực đơn bán trú" description="Thực đơn tuần do bộ phận bán trú/văn phòng nhập, Ban Giám hiệu phát hành." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link className={btn("secondary")} href={`?w=${addDays(week, -7)}`}>‹ Tuần trước</Link>
        <Link className={btn("secondary")} href="?">Tuần này</Link>
        <Link className={btn("secondary")} href={`?w=${addDays(week, 7)}`}>Tuần sau ›</Link>
        <h2 className="ml-2 font-semibold">{fmtDate(week)} – {fmtDate(addDays(week, 5))}</h2>
        {m && <Badge tone={m.status === "published" ? "success" : "warning"}>{m.status === "published" ? "✓ Đã phát hành" : "● Bản nháp"}</Badge>}
      </div>
      {!m && !edit ? <Card><EmptyState title="Chưa có thực đơn tuần này" /></Card> : edit ? (
        <Card>
          <ActionForm action={saveMenu} className="space-y-3">
            <input type="hidden" name="week_start" value={week} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WEEKDAYS.map((d, i) => (
                <label key={d.key} className="block rounded-lg border border-line p-3">
                  <span className="label">{d.label} · {fmtDate(addDays(week, i))}</span>
                  <textarea name={d.key} defaultValue={items[d.key] ?? ""} rows={3} className="input" />
                </label>
              ))}
            </div>
            <label className="block"><span className="label">Ghi chú</span><input name="note" defaultValue={m?.note ?? ""} className="input" /></label>
            <div className="flex gap-2">
              <SubmitButton variant="secondary" name="intent" value="save">Lưu</SubmitButton>
              {publish && <SubmitButton name="intent" value="publish">Lưu & phát hành</SubmitButton>}
            </div>
            {m?.published_at && <p className="text-xs text-muted">Phát hành {fmtDateTime(m.published_at)} bởi {(m as any).publisher?.full_name ?? "—"}</p>}
          </ActionForm>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WEEKDAYS.filter((d) => items[d.key]).map((d) => (
            <div key={d.key} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-brand-dark">{d.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{items[d.key]}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

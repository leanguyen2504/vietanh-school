import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Download, Scale, Wallet } from "lucide-react";
import clsx from "clsx";
import { requireModule } from "@/lib/auth";
import { can, PERMS, ROLE_LABELS } from "@/lib/roles";
import { cleanSearch, pageOf, PAGE_SIZE } from "@/lib/queries";
import { FIN_STATUS, loadEntries, periodOf, summarize } from "@/lib/finance";
import { fmtDate, fmtDateTime, fmtMoney, fmtMoneyShort, fmtMonth, todayVN } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, Pagination, StatCard, TableWrap, btn } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { HBarList, PairBarChart } from "@/components/charts";
import { addCategory, deleteEntry, reviewEntry, saveEntry, toggleCategory } from "./actions";

const PERIODS = [
  { key: "year", label: "Năm học" },
  { key: "12m", label: "12 tháng" },
  { key: "ytd", label: "Từ đầu năm" },
  { key: "month", label: "Tháng này" },
];

type SP = { period?: string; status?: string; kind?: string; q?: string; page?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireModule("finance");
  const { supabase, role } = ctx;
  const period = periodOf(ctx, sp.period);
  const canEnter = can(role, PERMS.financeEntry);
  const canApprove = can(role, PERMS.financeApprove);
  const isOwner = can(role, PERMS.financeAdmin);
  const today = todayVN();

  const status = ["pending", "approved", "rejected"].includes(sp.status ?? "") ? sp.status! : "";
  const kind = ["income", "expense"].includes(sp.kind ?? "") ? sp.kind! : "";
  const q = cleanSearch(sp.q);
  const page = pageOf(sp.page);

  let list = supabase
    .from("finance_entries")
    .select(
      "id, entry_date, kind, amount, description, status, review_note, reviewed_at, created_by, created_at, finance_categories(name), school_levels(name), creator:profiles!finance_entries_created_by_fkey(full_name), reviewer:profiles!finance_entries_reviewed_by_fkey(full_name)",
      { count: "exact" },
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) list = list.eq("status", status);
  else list = list.gte("entry_date", period.from).lte("entry_date", period.to);
  if (kind) list = list.eq("kind", kind);
  if (q) list = list.ilike("description", `%${q}%`);

  const [{ rows, error }, entries, pendingCount, cats, levels] = await Promise.all([
    loadEntries(ctx, period.from, period.to),
    list,
    supabase.from("finance_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("finance_categories").select("id, kind, name, is_active, sort_order").order("kind").order("sort_order").order("name"),
    supabase.from("school_levels").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const s = summarize(rows, period.from, period.to);
  const margin = s.income ? Math.round((s.net / s.income) * 100) : null;
  const thisMonth = s.months.at(-1);
  const lastMonth = s.months.at(-2);
  const catList = (cats.data ?? []) as any[];
  const pending = pendingCount.count ?? 0;

  return (
    <>
      <PageHeader
        title="Tài chính"
        description={`${period.label}: ${fmtDate(period.from)} – ${fmtDate(period.to)} · Số liệu chỉ tính các khoản đã duyệt · Bạn đang xem với vai trò ${ROLE_LABELS[role]}`}
        actions={
          <a className={btn("secondary")} href={`/api/export/finance?from=${period.from}&to=${period.to}`}>
            <Download className="h-4 w-4" aria-hidden /> Xuất CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`?period=${p.key}`}
            className={clsx("rounded-full border px-3 py-1 text-sm", period.key === p.key ? "border-brand bg-brand-soft font-medium text-brand-dark" : "border-line bg-surface text-muted hover:text-ink")}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {error && <div className="mb-4"><Alert tone="danger">Không tải được số liệu tài chính: {error.message}</Alert></div>}
      {pending > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            Có <strong>{pending}</strong> khoản thu/chi đang chờ duyệt.{" "}
            <Link className="link" href="?status=pending#so-thu-chi">{canApprove ? "Xem và duyệt" : "Xem danh sách"}</Link>
          </Alert>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng thu" value={fmtMoneyShort(s.income)} hint={fmtMoney(s.income)} icon={<ArrowDownRight className="h-5 w-5" />} />
        <StatCard label="Tổng chi" value={fmtMoneyShort(s.expense)} hint={fmtMoney(s.expense)} icon={<ArrowUpRight className="h-5 w-5" />} />
        <StatCard
          label="Chênh lệch thu − chi"
          value={<span className={s.net < 0 ? "text-danger" : "text-success"}>{fmtMoneyShort(s.net)}</span>}
          hint={margin == null ? "Chưa có khoản thu" : `Biên lợi nhuận ${margin}%`}
          icon={<Scale className="h-5 w-5" />}
        />
        <StatCard
          label={thisMonth ? `Tháng ${fmtMonth(thisMonth.ym)}` : "Tháng này"}
          value={thisMonth ? fmtMoneyShort(thisMonth.income - thisMonth.expense) : "—"}
          hint={thisMonth ? `Thu ${fmtMoneyShort(thisMonth.income)} · Chi ${fmtMoneyShort(thisMonth.expense)}${lastMonth ? ` · Tháng trước ${fmtMoneyShort(lastMonth.income - lastMonth.expense)}` : ""}` : undefined}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <Card title="Thu và chi theo tháng" className="mb-6">
        {s.months.length <= 1 && !rows.length ? (
          <EmptyState title="Chưa có số liệu trong khoảng thời gian này" />
        ) : (
          <>
            <PairBarChart
              data={s.months.map((m) => ({ key: m.ym, label: fmtMonth(m.ym), a: m.income, b: m.expense }))}
              aLabel="Thu" bLabel="Chi" format={fmtMoneyShort}
            />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">Xem bảng số liệu</summary>
              <TableWrap>
                <table className="table mt-2">
                  <thead><tr><th>Tháng</th><th className="text-right">Thu</th><th className="text-right">Chi</th><th className="text-right">Chênh lệch</th></tr></thead>
                  <tbody>
                    {s.months.map((m) => (
                      <tr key={m.ym}>
                        <td>{fmtMonth(m.ym)}</td>
                        <td className="text-right">{fmtMoney(m.income)}</td>
                        <td className="text-right">{fmtMoney(m.expense)}</td>
                        <td className={clsx("text-right font-medium", m.income - m.expense < 0 ? "text-danger" : "text-success")}>{fmtMoney(m.income - m.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </details>
          </>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Cơ cấu thu"><HBarList items={s.incomeByCategory} tone="income" format={fmtMoneyShort} /></Card>
        <Card title="Cơ cấu chi"><HBarList items={s.expenseByCategory} tone="expense" format={fmtMoneyShort} /></Card>
        <Card title="Học phí & bán trú theo cấp học"><HBarList items={s.incomeByLevel} tone="brand" format={fmtMoneyShort} /></Card>
      </div>

      {canEnter && (
        <Card title={isOwner ? "Ghi khoản thu/chi (tự động duyệt)" : "Ghi khoản thu/chi"} className="mb-6">
          {!isOwner && <p className="mb-3 text-sm text-muted">Khoản bạn ghi sẽ ở trạng thái chờ duyệt cho đến khi Ban Giám hiệu hoặc Chủ đầu tư duyệt.</p>}
          {isOwner && <p className="mb-3 text-sm text-muted">Ban Giám hiệu sẽ nhận được thông báo khi bạn thêm, sửa hoặc xóa khoản thu/chi.</p>}
          <ActionForm action={saveEntry} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label="Ngày" className="lg:col-span-1"><input className="input" type="date" name="entry_date" defaultValue={today} max={today} required /></Field>
            <Field label="Hạng mục" className="lg:col-span-2">
              <select className="input" name="category_id" required defaultValue="">
                <option value="" disabled>Chọn hạng mục</option>
                <optgroup label="Khoản thu">
                  {catList.filter((c) => c.kind === "income" && c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Khoản chi">
                  {catList.filter((c) => c.kind === "expense" && c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label="Cấp học (nếu có)" className="lg:col-span-1">
              <select className="input" name="level_id" defaultValue="">
                <option value="">Toàn trường</option>
                {(levels.data ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Số tiền (VNĐ)" className="lg:col-span-2"><input className="input" name="amount" inputMode="numeric" placeholder="Ví dụ 12500000" required /></Field>
            <Field label="Nội dung" className="sm:col-span-2 lg:col-span-5"><input className="input" name="description" maxLength={500} placeholder="Ví dụ: Thanh toán tiền điện tháng 11" /></Field>
            <div className="flex items-end lg:col-span-1"><SubmitButton className="w-full">Ghi sổ</SubmitButton></div>
          </ActionForm>
        </Card>
      )}

      <Card title="Sổ thu/chi" className="mb-6">
        <div id="so-thu-chi" className="mb-3 flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2" method="get">
            {sp.period && <input type="hidden" name="period" value={sp.period} />}
            <select name="status" defaultValue={status} className="input w-auto" aria-label="Trạng thái">
              <option value="">Trong kỳ đang xem</option>
              <option value="pending">Chờ duyệt (mọi thời điểm)</option>
              <option value="approved">Đã duyệt (mọi thời điểm)</option>
              <option value="rejected">Bị từ chối (mọi thời điểm)</option>
            </select>
            <select name="kind" defaultValue={kind} className="input w-auto" aria-label="Loại">
              <option value="">Thu và chi</option>
              <option value="income">Chỉ khoản thu</option>
              <option value="expense">Chỉ khoản chi</option>
            </select>
            <input name="q" defaultValue={q} placeholder="Tìm theo nội dung" className="input w-48" />
            <button className={btn("secondary")}>Lọc</button>
          </form>
        </div>
        {!entries.data?.length ? (
          <EmptyState title="Không có khoản nào phù hợp" />
        ) : (
          <>
            <TableWrap>
              <table className="table">
                <thead>
                  <tr><th>Ngày</th><th>Hạng mục</th><th className="text-right">Số tiền</th><th>Nội dung</th><th>Người ghi</th><th>Trạng thái</th><th></th></tr>
                </thead>
                <tbody>
                  {(entries.data as any[]).map((e) => {
                    const st = FIN_STATUS[e.status];
                    const mineOpen = e.created_by === ctx.userId && e.status !== "approved";
                    return (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                        <td>
                          <span className="flex items-center gap-1.5">
                            <span className={clsx("h-2 w-2 shrink-0 rounded-sm", e.kind === "income" ? "bg-income" : "bg-expense")} aria-hidden />
                            {e.kind === "income" ? "Thu" : "Chi"} · {e.finance_categories?.name}
                          </span>
                          {e.school_levels?.name && <span className="text-xs text-muted">{e.school_levels.name}</span>}
                        </td>
                        <td className="whitespace-nowrap text-right font-medium">{e.kind === "expense" ? "−" : ""}{fmtMoney(Number(e.amount))}</td>
                        <td className="min-w-48">{e.description ?? "—"}</td>
                        <td className="whitespace-nowrap text-xs">{e.creator?.full_name ?? "—"}<span className="block text-muted">{fmtDateTime(e.created_at)}</span></td>
                        <td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {e.reviewer?.full_name && e.status !== "pending" && <span className="mt-0.5 block text-xs text-muted">{e.reviewer.full_name}</span>}
                          {e.review_note && <span className="mt-0.5 block text-xs text-muted">“{e.review_note}”</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex flex-wrap items-start gap-1">
                            {canApprove && e.status === "pending" && (
                              <>
                                <ActionButton action={reviewEntry} fields={{ id: e.id, decision: "approved" }} variant="primary">Duyệt</ActionButton>
                                <details className="relative">
                                  <summary className={clsx(btn("secondary"), "list-none")}>Từ chối</summary>
                                  <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-surface p-3 shadow-lg">
                                    <ActionForm action={reviewEntry}>
                                      <input type="hidden" name="id" value={e.id} />
                                      <input type="hidden" name="decision" value="rejected" />
                                      <label className="label" htmlFor={`note-${e.id}`}>Lý do</label>
                                      <input id={`note-${e.id}`} name="review_note" className="input mb-2" required maxLength={500} />
                                      <SubmitButton variant="danger">Xác nhận từ chối</SubmitButton>
                                    </ActionForm>
                                  </div>
                                </details>
                              </>
                            )}
                            {(isOwner || (role === "accountant" && mineOpen)) && (
                              <ActionButton action={deleteEntry} fields={{ id: e.id }} variant="ghost" confirm="Xóa khoản thu/chi này?">Xóa</ActionButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={entries.count ?? 0} params={{ period: sp.period, status, kind, q: q || undefined }} />
          </>
        )}
      </Card>

      {isOwner && (
        <Card title="Hạng mục thu/chi">
          <div className="grid gap-6 md:grid-cols-2">
            {(["income", "expense"] as const).map((k) => (
              <div key={k}>
                <p className="mb-2 text-sm font-medium">{k === "income" ? "Khoản thu" : "Khoản chi"}</p>
                <ul className="space-y-1 text-sm">
                  {catList.filter((c) => c.kind === k).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-page">
                      <span className={c.is_active ? "" : "text-muted line-through"}>{c.name}</span>
                      <ActionButton action={toggleCategory} fields={{ id: c.id, active: String(!c.is_active) }} variant="ghost">
                        {c.is_active ? "Ngừng dùng" : "Dùng lại"}
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <ActionForm action={addCategory} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Field label="Loại"><select name="kind" className="input w-auto"><option value="income">Khoản thu</option><option value="expense">Khoản chi</option></select></Field>
            <Field label="Tên hạng mục"><input name="name" className="input" required maxLength={80} /></Field>
            <SubmitButton variant="secondary">Thêm hạng mục</SubmitButton>
          </ActionForm>
        </Card>
      )}
      <p className="mt-6 text-xs text-muted">Số liệu tài chính hiện tại là dữ liệu demo hư cấu, chỉ để minh họa.</p>
    </>
  );
}

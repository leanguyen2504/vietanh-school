import "server-only";
import type { Ctx } from "@/lib/auth";
import { todayVN } from "@/lib/format";

export type FinEntry = {
  id: string; entry_date: string; kind: "income" | "expense"; amount: number; description: string | null;
  status: "pending" | "approved" | "rejected"; category: string; level: string | null;
};

export const FIN_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  rejected: { label: "Bị từ chối", tone: "danger" },
};

export type Period = { key: string; label: string; from: string; to: string };

/** Khoảng thời gian xem báo cáo */
export function periodOf(ctx: Ctx, key?: string): Period {
  const today = todayVN();
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  if (key === "month") return { key, label: "Tháng này", from: monthStart, to: today };
  if (key === "12m") {
    const d = new Date(Date.UTC(y, m - 12, 1));
    return { key, label: "12 tháng gần nhất", from: d.toISOString().slice(0, 10), to: today };
  }
  if (key === "ytd") return { key, label: `Năm ${y}`, from: `${y}-01-01`, to: today };
  if (ctx.year) {
    const to = ctx.year.end_date < today ? ctx.year.end_date : today;
    return { key: "year", label: `Năm học ${ctx.year.name}`, from: ctx.year.start_date, to };
  }
  return { key: "ytd", label: `Năm ${y}`, from: `${y}-01-01`, to: today };
}

export async function loadEntries(ctx: Ctx, from: string, to: string, status: "approved" | "pending" = "approved") {
  const { data, error } = await ctx.supabase
    .from("finance_entries")
    .select("id, entry_date, kind, amount, description, status, finance_categories(name), school_levels(name)")
    .eq("status", status)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date")
    .limit(10000);
  const rows: FinEntry[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id, entry_date: r.entry_date, kind: r.kind, amount: Number(r.amount), description: r.description, status: r.status,
    category: r.finance_categories?.name ?? "—", level: r.school_levels?.name ?? null,
  }));
  return { rows, error };
}

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function summarize(rows: FinEntry[], from: string, to: string) {
  const income = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  const months = monthsBetween(from, to).map((ym) => {
    const inMonth = rows.filter((r) => r.entry_date.startsWith(ym));
    return {
      ym,
      income: inMonth.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0),
      expense: inMonth.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0),
    };
  });
  const group = (kind: "income" | "expense", key: (r: FinEntry) => string | null) => {
    const m = new Map<string, number>();
    rows.filter((r) => r.kind === kind).forEach((r) => {
      const k = key(r);
      if (k) m.set(k, (m.get(k) ?? 0) + r.amount);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  return {
    income, expense, net: income - expense, months,
    incomeByCategory: group("income", (r) => r.category),
    expenseByCategory: group("expense", (r) => r.category),
    incomeByLevel: group("income", (r) => r.level),
  };
}

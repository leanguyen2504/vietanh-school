import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { can, MODULE_ACCESS } from "@/lib/roles";
import { toCSV } from "@/lib/format";
import { FIN_STATUS } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!can(ctx.role, MODULE_ACCESS.finance)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "Khoảng thời gian không hợp lệ" }, { status: 400 });
  const { data, error } = await ctx.supabase
    .from("finance_entries")
    .select("entry_date, kind, amount, description, status, finance_categories(name), school_levels(name)")
    .gte("entry_date", from).lte("entry_date", to).order("entry_date").limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await ctx.supabase.rpc("log_event", { p_action: "export", p_entity: "finance_entries", p_detail: { from, to, rows: data?.length ?? 0 } });
  const csv = toCSV(
    ["Ngày", "Loại", "Hạng mục", "Cấp học", "Số tiền (VNĐ)", "Nội dung", "Trạng thái"],
    (data ?? []).map((r: any) => [r.entry_date, r.kind === "income" ? "Thu" : "Chi", r.finance_categories?.name, r.school_levels?.name ?? "", r.amount, r.description ?? "", FIN_STATUS[r.status]?.label ?? r.status]),
  );
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="thu-chi_${from}_${to}.csv"` },
  });
}

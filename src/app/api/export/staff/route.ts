import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { cleanSearch } from "@/lib/queries";
import { toCSV } from "@/lib/format";
import { STAFF_STATUS } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!can(ctx.role, PERMS.exportPersonal)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  let q = ctx.supabase.from("staff").select("code, full_name, work_email, work_phone, position, status, departments(name)");
  const s = cleanSearch(sp.get("q") ?? "");
  if (s) q = q.or(`full_name.ilike.%${s}%,code.ilike.%${s}%`);
  if (sp.get("dept")) q = q.eq("department_id", sp.get("dept")!);
  if (sp.get("status")) q = q.eq("status", sp.get("status")!);
  const { data, error } = await q.order("full_name").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await ctx.supabase.rpc("log_event", { p_action: "export", p_entity: "staff", p_detail: { rows: data?.length ?? 0 } });
  const csv = toCSV(["Mã", "Họ tên", "Email công vụ", "Điện thoại", "Tổ/bộ phận", "Chức vụ", "Trạng thái"],
    (data ?? []).map((r: any) => [r.code, r.full_name, r.work_email, r.work_phone, r.departments?.name, r.position, STAFF_STATUS[r.status]]));
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="nhan-su.csv"', "Cache-Control": "no-store" } });
}

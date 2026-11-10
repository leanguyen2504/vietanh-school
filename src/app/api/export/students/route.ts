import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { cleanSearch } from "@/lib/queries";
import { toCSV } from "@/lib/format";
import { GENDER, STUDENT_STATUS } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!can(ctx.role, PERMS.exportPersonal)) return NextResponse.json({ error: "Không có quyền xuất dữ liệu" }, { status: 403 });
  if (!ctx.year) return NextResponse.json({ error: "Chưa có năm học" }, { status: 400 });
  const sp = req.nextUrl.searchParams;
  let q = ctx.supabase
    .from("students")
    .select("code, full_name, date_of_birth, gender, status, enrollments!inner(status, academic_year_id, class_id, classes!inner(name, grade_id)), student_guardians(relationship, is_primary, guardians(full_name, phone))")
    .eq("enrollments.academic_year_id", ctx.year.id);
  const s = cleanSearch(sp.get("q") ?? "");
  if (s) q = q.or(`full_name.ilike.%${s}%,code.ilike.%${s}%`);
  if (sp.get("class")) q = q.eq("enrollments.class_id", sp.get("class")!);
  if (sp.get("grade")) q = q.eq("enrollments.classes.grade_id", sp.get("grade")!);
  if (sp.get("status")) q = q.eq("status", sp.get("status")!);
  else q = q.eq("enrollments.status", "active");
  const { data, error } = await q.order("full_name").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => {
    const g = (r.student_guardians ?? []).find((x: any) => x.is_primary) ?? r.student_guardians?.[0];
    return [r.code, r.full_name, r.date_of_birth ?? "", GENDER[r.gender] ?? "", r.enrollments?.map((e: any) => e.classes?.name).join(" "),
      STUDENT_STATUS[r.status], g?.guardians?.full_name ?? "", g?.relationship ?? "", g?.guardians?.phone ?? ""];
  });
  // Ghi nhật ký xuất dữ liệu cá nhân (chỉ số lượng, không ghi nội dung)
  await ctx.supabase.rpc("log_event", { p_action: "export", p_entity: "students", p_detail: { rows: rows.length, year: ctx.year.name } });
  const csv = toCSV(["Mã HS", "Họ tên", "Ngày sinh", "Giới tính", "Lớp", "Trạng thái", "Người giám hộ", "Quan hệ", "Điện thoại"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hoc-sinh-${ctx.year.name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

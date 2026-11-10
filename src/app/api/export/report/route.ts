import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/auth";
import { can, MODULE_ACCESS } from "@/lib/roles";
import { toCSV, todayVN } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!can(ctx.role, MODULE_ACCESS.reports)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  if (!ctx.year) return NextResponse.json({ error: "Chưa có năm học" }, { status: 400 });
  const type = req.nextUrl.searchParams.get("type");
  let csv = "";
  let name = "bao-cao";
  if (type === "enrollment") {
    const { data } = await ctx.supabase.rpc("report_enrollment_summary", { p_year: ctx.year.id });
    csv = toCSV(["Cấp học", "Khối", "Lớp", "Sĩ số"], ((data ?? []) as any[]).map((r) => [r.level_name, r.grade_name, r.class_name, r.student_count]));
    name = `si-so-${ctx.year.name}`;
  } else if (type === "attendance") {
    const d = req.nextUrl.searchParams.get("date") ?? todayVN();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayVN();
    const { data } = await ctx.supabase.rpc("report_attendance_day", { p_year: ctx.year.id, p_date: date });
    csv = toCSV(["Lớp", "Tình trạng", "Tổng", "Có mặt", "Nghỉ có phép", "Nghỉ không phép", "Đi muộn"],
      ((data ?? []) as any[]).map((r) => [r.class_name, r.session_status, r.total, r.present, r.excused, r.unexcused, r.late]));
    name = `diem-danh-${date}`;
  } else if (type === "tasks") {
    const { data } = await ctx.supabase.from("tasks").select("title, status, due_date, assignee:assignee_id(full_name), assigner:assigner_id(full_name)");
    csv = toCSV(["Công việc", "Trạng thái", "Hạn", "Người phụ trách", "Người giao"],
      ((data ?? []) as any[]).map((t) => [t.title, TASK_STATUS[t.status], t.due_date, t.assignee?.full_name, t.assigner?.full_name]));
    name = "cong-viec";
  } else return NextResponse.json({ error: "Loại báo cáo không hợp lệ" }, { status: 400 });
  await ctx.supabase.rpc("log_event", { p_action: "export", p_entity: `report_${type}`, p_detail: null });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}

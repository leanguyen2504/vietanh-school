"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, getCtx, type ActionState } from "@/lib/auth";

const Payload = z.object({
  class_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["full_day", "morning", "afternoon"]),
  confirm: z.boolean(),
  reason: z.string().max(500).optional(),
  records: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(["present", "excused", "unexcused", "late"]),
    reason: z.string().max(300).optional(),
  })).max(200),
});

export async function saveAttendance(input: unknown): Promise<ActionState> {
  const ctx = await getCtx();
  const p = Payload.safeParse(input);
  if (!p.success) return { error: "Dữ liệu điểm danh không hợp lệ." };
  // Quyền (giáo viên được phân công / BGH), lý do sửa sau xác nhận và nhật ký được kiểm tra trong hàm database save_attendance
  const { error } = await ctx.supabase.rpc("save_attendance", {
    p_class: p.data.class_id, p_date: p.data.date, p_session: p.data.session,
    p_records: p.data.records, p_confirm: p.data.confirm, p_reason: p.data.reason || null,
  });
  if (error) return { error: dbError(error) };
  revalidatePath("/attendance");
  revalidatePath("/");
  return { ok: true, message: p.data.confirm ? "Đã xác nhận hoàn tất điểm danh." : "Đã lưu nháp điểm danh." };
}

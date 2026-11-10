"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";

const ClassSchema = z.object({
  name: z.string().trim().min(1, "Cần tên lớp").max(20),
  grade_id: z.string().uuid("Chọn khối"),
  room: z.string().trim().max(30).optional().transform((v) => v || null),
  capacity: z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 100), "Sĩ số tối đa không hợp lệ"),
  homeroom_staff_id: z.string().optional().transform((v) => v || null),
});

export async function createClass(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageClasses);
  if (isErr(ctx)) return ctx;
  if (!ctx.year) return { error: "Chưa có năm học." };
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data, error } = await ctx.supabase.from("classes").insert({ ...p.data, academic_year_id: ctx.year.id }).select("id").single();
  if (error) return { error: dbError(error) };
  if (p.data.homeroom_staff_id) {
    await ctx.supabase.from("teaching_assignments").insert({ academic_year_id: ctx.year.id, class_id: data.id, staff_id: p.data.homeroom_staff_id, is_homeroom: true, subject: "Chủ nhiệm" });
  }
  revalidatePath("/classes");
  return { ok: true, message: `Đã tạo lớp ${p.data.name}.` };
}

export async function updateClass(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageClasses);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const p = ClassSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const status = z.enum(["active", "ended", "archived"]).catch("active").parse(fd.get("status"));
  const { data: before } = await ctx.supabase.from("classes").select("homeroom_staff_id, academic_year_id").eq("id", id).single();
  const { error } = await ctx.supabase.from("classes").update({ ...p.data, status }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (before && before.homeroom_staff_id !== p.data.homeroom_staff_id) {
    await ctx.supabase.from("teaching_assignments").delete().eq("class_id", id).eq("is_homeroom", true);
    if (p.data.homeroom_staff_id) {
      await ctx.supabase.from("teaching_assignments").insert({ academic_year_id: before.academic_year_id, class_id: id, staff_id: p.data.homeroom_staff_id, is_homeroom: true, subject: "Chủ nhiệm" });
    }
  }
  revalidatePath(`/classes/${id}`);
  return { ok: true, message: "Đã lưu lớp." };
}

export async function addAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageClasses);
  if (isErr(ctx)) return ctx;
  const classId = String(fd.get("class_id"));
  const staffId = String(fd.get("staff_id") ?? "");
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 60);
  if (!staffId || !subject) return { error: "Chọn giáo viên và nhập môn." };
  const { data: c } = await ctx.supabase.from("classes").select("academic_year_id").eq("id", classId).single();
  if (!c) return { error: "Không tìm thấy lớp." };
  const { error } = await ctx.supabase.from("teaching_assignments").insert({ academic_year_id: c.academic_year_id, class_id: classId, staff_id: staffId, subject });
  if (error) return { error: dbError(error) };
  revalidatePath(`/classes/${classId}`);
  return { ok: true, message: "Đã phân công." };
}

export async function removeAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageClasses);
  if (isErr(ctx)) return ctx;
  const { error } = await ctx.supabase.from("teaching_assignments").delete().eq("id", String(fd.get("id")));
  if (error) return { error: dbError(error) };
  revalidatePath(`/classes/${String(fd.get("class_id"))}`);
  return { ok: true, message: "Đã bỏ phân công." };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN = ["admin"] as const;

export async function createYear(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const p = z.object({
    name: z.string().trim().regex(/^\d{4}-\d{4}$/, "Tên năm học dạng 2027-2028"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Cần ngày bắt đầu"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Cần ngày kết thúc"),
    copy_from: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.end_date <= p.data.start_date) return { error: "Ngày kết thúc phải sau ngày bắt đầu." };
  const { data, error } = await ctx.supabase.from("academic_years").insert({ name: p.data.name, start_date: p.data.start_date, end_date: p.data.end_date, status: "draft" }).select("id").single();
  if (error) return { error: dbError(error) };
  let msg = `Đã tạo năm học ${p.data.name} (bản nháp).`;
  if (p.data.copy_from) {
    const { data: n, error: e2 } = await ctx.supabase.rpc("copy_classes_from_year", { p_from: p.data.copy_from, p_to: data.id });
    if (e2) return { error: "Đã tạo năm học nhưng không sao chép được lớp: " + dbError(e2) };
    msg += ` Đã sao chép ${n} lớp dưới dạng nháp; hãy kiểm tra GVCN và sĩ số trước khi kích hoạt.`;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: msg };
}

export async function setYearStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (status === "active") {
    const { error } = await ctx.supabase.rpc("activate_year", { p_year: id });
    if (error) return { error: dbError(error) };
  } else if (["draft", "locked", "archived"].includes(status)) {
    const { error } = await ctx.supabase.from("academic_years").update({ status }).eq("id", id);
    if (error) return { error: dbError(error) };
  } else return { error: "Trạng thái không hợp lệ." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã cập nhật năm học." };
}

export async function toggleLevel(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const { error } = await ctx.supabase.from("school_levels").update({ is_active: fd.get("active") === "true" }).eq("id", String(fd.get("id")));
  if (error) return { error: dbError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Đã cập nhật cấp học." };
}

export async function addDepartment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const p = z.object({ code: z.string().trim().min(1).max(20), name: z.string().trim().min(2).max(100), level_id: z.string().optional().transform((v) => v || null) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Cần mã và tên tổ/bộ phận." };
  const { error } = await ctx.supabase.from("departments").insert(p.data);
  if (error) return { error: dbError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Đã thêm tổ/bộ phận." };
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const role = String(fd.get("role") ?? "");
  const roles = ["admin", "board", "principal", "head", "teacher", "office", "health", "parent"];
  const { error } = await ctx.supabase.from("profiles").update({
    role: roles.includes(role) ? role : null,
    is_active: fd.get("is_active") === "on",
    staff_id: String(fd.get("staff_id") ?? "") || null,
  }).eq("id", id);
  if (error) return { error: dbError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Đã cập nhật tài khoản." };
}

export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const email = z.string().email().safeParse(String(fd.get("email") ?? "").trim());
  if (!email.success) return { error: "Email không hợp lệ." };
  const name = String(fd.get("full_name") ?? "").trim().slice(0, 120);
  const admin = createAdminClient();
  if (!admin) return { error: "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên máy chủ. Có thể tạo tài khoản trong Supabase > Authentication > Users rồi cấp vai trò tại đây." };
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const { error } = await admin.auth.admin.inviteUserByEmail(email.data, { data: { full_name: name }, redirectTo: `${site}/auth/callback?next=/auth/reset` });
  if (error) return { error: "Không gửi được lời mời: " + error.message };
  await ctx.supabase.rpc("log_event", { p_action: "invite", p_entity: "profiles", p_detail: null });
  revalidatePath("/settings");
  return { ok: true, message: "Đã gửi lời mời. Sau khi người dùng nhận lời mời, hãy cấp vai trò và kích hoạt tài khoản." };
}

export async function updateSetting(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...ADMIN]);
  if (isErr(ctx)) return ctx;
  const updates: [string, unknown][] = [
    ["announcement_requires_approval", fd.get("announcement_requires_approval") === "on"],
    ["attendance_edit_requires_reason", fd.get("attendance_edit_requires_reason") === "on"],
    ["document_max_mb", Math.min(50, Math.max(1, Number(fd.get("document_max_mb")) || 10))],
    ["document_allowed_ext", String(fd.get("document_allowed_ext") ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/^\./, "")).filter((s) => /^[a-z0-9]{1,8}$/.test(s))],
  ];
  for (const [key, value] of updates) {
    const { error } = await ctx.supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return { error: dbError(error) };
  }
  revalidatePath("/settings");
  return { ok: true, message: "Đã lưu cấu hình." };
}

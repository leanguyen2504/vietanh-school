"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";

const Schema = z.object({
  title: z.string().trim().min(3, "Tiêu đề quá ngắn").max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  assignee_id: z.string().uuid("Chọn người phụ trách"),
  due_date: z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  document_id: z.string().optional().transform((v) => v || null),
});

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.createTasks);
  if (isErr(ctx)) return ctx;
  const p = Schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await ctx.supabase.from("tasks").insert({ ...p.data, assigner_id: ctx.userId, department_id: ctx.departmentId });
  if (error) return { error: dbError(error) };
  revalidatePath("/tasks");
  return { ok: true, message: "Đã giao việc." };
}

export async function updateTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.createTasks);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const status = z.enum(["new", "in_progress", "waiting", "done"]).safeParse(fd.get("status"));
  const content = String(fd.get("content") ?? "").trim().slice(0, 2000);
  if (!status.success) return { error: "Trạng thái không hợp lệ." };
  const { data: t } = await ctx.supabase.from("tasks").select("status").eq("id", id).maybeSingle();
  if (!t) return { error: "Không tìm thấy công việc hoặc bạn không có quyền." };
  if (t.status !== status.data) {
    const { error, count } = await ctx.supabase.from("tasks").update({ status: status.data }, { count: "exact" }).eq("id", id);
    if (error) return { error: dbError(error) };
    if (!count) return { error: "Bạn không có quyền cập nhật công việc này." };
  }
  if (content) {
    const { error } = await ctx.supabase.from("task_updates").insert({ task_id: id, author_id: ctx.userId, content });
    if (error) return { error: dbError(error) };
  }
  if (t.status === status.data && !content) return { error: "Không có thay đổi." };
  revalidatePath(`/tasks/${id}`);
  return { ok: true, message: "Đã cập nhật." };
}

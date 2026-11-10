"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";
import { vnLocalToISO } from "@/lib/format";

const Schema = z.object({
  title: z.string().trim().min(2, "Cần tiêu đề").max(200),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  start_at: z.string().min(1, "Cần thời gian bắt đầu"),
  end_at: z.string().optional(),
  location: z.string().trim().max(120).optional().transform((v) => v || null),
  owner_staff_id: z.string().optional().transform((v) => v || null),
  participants: z.string().trim().max(300).optional().transform((v) => v || null),
  document_id: z.string().optional().transform((v) => v || null),
});

export async function saveEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageEvents);
  if (isErr(ctx)) return ctx;
  const p = Schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const start = vnLocalToISO(p.data.start_at);
  const end = p.data.end_at ? vnLocalToISO(p.data.end_at) : null;
  if (end && end < start) return { error: "Thời gian kết thúc phải sau thời gian bắt đầu." };
  const { error } = await ctx.supabase.from("events").insert({ ...p.data, start_at: start, end_at: end });
  if (error) return { error: dbError(error) };
  revalidatePath("/events");
  return { ok: true, message: "Đã thêm lịch công tác." };
}

export async function deleteEvent(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageEvents);
  if (isErr(ctx)) return ctx;
  const { error, count } = await ctx.supabase.from("events").delete({ count: "exact" }).eq("id", String(fd.get("id")));
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Bạn chỉ xóa được lịch do mình tạo." };
  revalidatePath("/events");
  return { ok: true, message: "Đã xóa lịch." };
}

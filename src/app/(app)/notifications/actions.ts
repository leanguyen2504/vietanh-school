"use server";

import { revalidatePath } from "next/cache";
import { getCtx, type ActionState } from "@/lib/auth";

export async function markAllRead(): Promise<ActionState> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", ctx.userId).is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã đánh dấu tất cả là đã đọc." };
}

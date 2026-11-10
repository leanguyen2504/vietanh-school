"use server";

import { revalidatePath } from "next/cache";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";
import { WEEKDAYS, mondayOf } from "@/lib/format";

export async function saveMenu(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.editMenus);
  if (isErr(ctx)) return ctx;
  const week = String(fd.get("week_start") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || mondayOf(week) !== week) return { error: "Tuần không hợp lệ." };
  const items: Record<string, string> = {};
  WEEKDAYS.forEach((d) => { const v = String(fd.get(d.key) ?? "").trim().slice(0, 500); if (v) items[d.key] = v; });
  const publish = fd.get("intent") === "publish";
  const row: any = { week_start: week, items, note: String(fd.get("note") ?? "").trim().slice(0, 500) || null };
  if (publish) row.status = "published";
  const { error } = await ctx.supabase.from("menus").upsert(row, { onConflict: "week_start" });
  if (error) return { error: dbError(error) };
  revalidatePath("/menus");
  return { ok: true, message: publish ? "Đã phát hành thực đơn." : "Đã lưu thực đơn (chưa phát hành)." };
}

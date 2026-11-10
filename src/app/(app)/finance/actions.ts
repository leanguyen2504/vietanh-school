"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";

const uuid = z.string().uuid();

const EntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Cần ngày hợp lệ"),
  category_id: uuid,
  level_id: z.string().optional().transform((v) => v || null),
  amount: z
    .string()
    .transform((v) => Number(v.replace(/[^\d]/g, "")))
    .pipe(z.number().int().positive("Số tiền phải lớn hơn 0").max(99_999_999_999, "Số tiền quá lớn")),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function saveEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.financeEntry);
  if (isErr(ctx)) return ctx;
  const p = EntrySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { data: cat } = await ctx.supabase.from("finance_categories").select("kind").eq("id", p.data.category_id).single();
  if (!cat) return { error: "Hạng mục không tồn tại." };
  const { error } = await ctx.supabase.from("finance_entries").insert({ ...p.data, kind: cat.kind });
  if (error) return { error: dbError(error) };
  revalidatePath("/finance");
  return {
    ok: true,
    message: ctx.role === "owner" ? "Đã ghi sổ (tự động duyệt) và báo cho Ban Giám hiệu." : "Đã ghi sổ. Khoản này đang chờ Ban Giám hiệu hoặc Chủ đầu tư duyệt.",
  };
}

const ReviewSchema = z.object({
  id: uuid,
  decision: z.enum(["approved", "rejected"]),
  review_note: z.string().trim().max(500).optional().transform((v) => v || null),
});

export async function reviewEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.financeApprove);
  if (isErr(ctx)) return ctx;
  const p = ReviewSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Dữ liệu không hợp lệ." };
  if (p.data.decision === "rejected" && !p.data.review_note) return { error: "Cần ghi lý do từ chối." };
  const { error, count } = await ctx.supabase
    .from("finance_entries")
    .update({ status: p.data.decision, review_note: p.data.review_note }, { count: "exact" })
    .eq("id", p.data.id)
    .eq("status", "pending");
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Khoản này không còn ở trạng thái chờ duyệt." };
  revalidatePath("/finance");
  return { ok: true, message: p.data.decision === "approved" ? "Đã duyệt." : "Đã từ chối." };
}

export async function deleteEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard([...PERMS.financeEntry]);
  if (isErr(ctx)) return ctx;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Dữ liệu không hợp lệ." };
  const { error, count } = await ctx.supabase.from("finance_entries").delete({ count: "exact" }).eq("id", id.data);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Không xóa được khoản này." };
  revalidatePath("/finance");
  return { ok: true, message: "Đã xóa." };
}

const CatSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(2, "Cần tên hạng mục").max(80),
});

export async function addCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.financeAdmin);
  if (isErr(ctx)) return ctx;
  const p = CatSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await ctx.supabase.from("finance_categories").insert({ ...p.data, sort_order: 50 });
  if (error) return { error: dbError(error) };
  revalidatePath("/finance");
  return { ok: true, message: "Đã thêm hạng mục." };
}

export async function toggleCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.financeAdmin);
  if (isErr(ctx)) return ctx;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Dữ liệu không hợp lệ." };
  const active = fd.get("active") === "true";
  const { error } = await ctx.supabase.from("finance_categories").update({ is_active: active }).eq("id", id.data);
  if (error) return { error: dbError(error) };
  revalidatePath("/finance");
  return { ok: true };
}

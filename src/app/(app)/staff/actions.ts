"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";

const StaffSchema = z.object({
  code: z.string().trim().min(1, "Cần mã nhân sự").max(30),
  full_name: z.string().trim().min(2, "Cần họ tên").max(120),
  work_email: z.string().trim().email("Email công vụ không hợp lệ").optional().or(z.literal("")).transform((v) => v || null),
  work_phone: z.string().trim().max(20).regex(/^[0-9+ .-]*$/, "Số điện thoại không hợp lệ").optional().transform((v) => v || null),
  department_id: z.string().optional().transform((v) => v || null),
  position: z.string().trim().max(80).optional().transform((v) => v || null),
  status: z.enum(["working", "on_leave", "resigned"]).default("working"),
});

export async function saveStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStaff);
  if (isErr(ctx)) return ctx;
  const p = StaffSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const { error } = await ctx.supabase.from("staff").update(p.data).eq("id", id);
    if (error) return { error: dbError(error) };
    revalidatePath(`/staff/${id}`);
    return { ok: true, message: "Đã lưu hồ sơ nhân sự." };
  }
  const { data, error } = await ctx.supabase.from("staff").insert(p.data).select("id").single();
  if (error) return { error: dbError(error) };
  revalidatePath("/staff");
  redirect(`/staff/${data.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";
import { uploadFile } from "@/lib/files";

export async function uploadDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.uploadDocuments);
  if (isErr(ctx)) return ctx;
  const p = z.object({
    title: z.string().trim().min(2, "Cần tiêu đề").max(200),
    doc_type: z.string().trim().max(40),
    access_level: z.enum(["all_staff", "department", "leadership"]),
    department_id: z.string().optional().transform((v) => v || null),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chọn tệp để tải lên." };
  const department_id = ctx.role === "head" ? ctx.departmentId : p.data.department_id;
  if (p.data.access_level === "department" && !department_id) return { error: "Chọn tổ/bộ phận cho tài liệu giới hạn theo bộ phận." };
  const up = await uploadFile(ctx, file, "library");
  if ("error" in up) return { error: up.error };
  const { error } = await ctx.supabase.from("documents").insert({
    title: p.data.title, doc_type: p.data.doc_type, access_level: p.data.access_level, department_id,
    academic_year_id: ctx.year?.id ?? null, storage_path: up.path, file_name: file.name.slice(-200), mime_type: up.mime, size_bytes: up.size, uploaded_by: ctx.userId,
  });
  if (error) {
    await ctx.supabase.storage.from("documents").remove([up.path]);
    return { error: dbError(error) };
  }
  revalidatePath("/documents");
  return { ok: true, message: "Đã tải tài liệu lên." };
}

export async function deleteDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.uploadDocuments);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const { data: d } = await ctx.supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!d) return { error: "Không tìm thấy tài liệu." };
  const { error, count } = await ctx.supabase.from("documents").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (!count) return { error: "Bạn chỉ xóa được tài liệu do mình tải lên." };
  await ctx.supabase.storage.from("documents").remove([d.storage_path]);
  revalidatePath("/documents");
  return { ok: true, message: "Đã xóa tài liệu." };
}

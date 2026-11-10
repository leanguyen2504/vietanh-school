"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS, can } from "@/lib/roles";
import { vnLocalToISO } from "@/lib/format";
import { uploadFile } from "@/lib/files";

const Schema = z.object({
  title: z.string().trim().min(3, "Tiêu đề quá ngắn").max(200),
  body: z.string().trim().min(3, "Nội dung trống").max(20000),
  audience_type: z.enum(["all", "staff", "level", "class", "department", "role"]),
  priority: z.enum(["normal", "high", "urgent"]),
  publish_at: z.string().optional(),
  expires_at: z.string().optional(),
});

export async function saveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.composeAnnouncement);
  if (isErr(ctx)) return ctx;
  const p = Schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const intent = String(fd.get("intent") ?? "draft"); // draft | submit | publish
  const audience_ids = fd.getAll("audience_ids").map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v));
  const audience_roles = fd.getAll("audience_roles").map(String);
  if (["level", "class", "department"].includes(p.data.audience_type) && audience_ids.length === 0) return { error: "Chọn ít nhất một nhóm nhận." };
  if (p.data.audience_type === "role" && audience_roles.length === 0) return { error: "Chọn ít nhất một vai trò nhận." };
  const publishAt = p.data.publish_at ? vnLocalToISO(p.data.publish_at) : null;
  const expiresAt = p.data.expires_at ? vnLocalToISO(p.data.expires_at) : null;
  if (publishAt && expiresAt && expiresAt <= publishAt) return { error: "Thời gian hết hiệu lực phải sau thời gian phát hành." };

  const { data: setting } = await ctx.supabase.from("app_settings").select("value").eq("key", "announcement_requires_approval").maybeSingle();
  const canPublish = can(ctx.role, PERMS.approveAnnouncement) || setting?.value === false;
  let status: string = "draft";
  if (intent === "submit") status = "pending";
  if (intent === "publish") {
    if (!canPublish) return { error: "Bạn cần gửi duyệt thông báo này." };
    status = publishAt && publishAt > new Date().toISOString() ? "scheduled" : "published";
  }

  const row: any = {
    title: p.data.title, body: p.data.body, audience_type: p.data.audience_type, priority: p.data.priority,
    audience_ids: ["level", "class", "department"].includes(p.data.audience_type) ? audience_ids : [],
    audience_roles: p.data.audience_type === "role" ? audience_roles : [],
    publish_at: publishAt, expires_at: expiresAt, status, return_reason: null,
  };
  const file = fd.get("attachment");
  if (file instanceof File && file.size > 0) {
    const up = await uploadFile(ctx, file, "announcements");
    if ("error" in up) return { error: up.error };
    row.attachment_path = up.path;
  }
  const id = String(fd.get("id") ?? "");
  const res = id
    ? await ctx.supabase.from("announcements").update(row).eq("id", id).select("id").single()
    : await ctx.supabase.from("announcements").insert(row).select("id").single();
  if (res.error) return { error: dbError(res.error) };
  revalidatePath("/announcements");
  redirect(`/announcements/${res.data.id}?saved=${status}`);
}

export async function reviewAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.approveAnnouncement);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const decision = String(fd.get("decision"));
  if (decision === "approve") {
    const { data: a } = await ctx.supabase.from("announcements").select("publish_at").eq("id", id).single();
    const status = a?.publish_at && a.publish_at > new Date().toISOString() ? "scheduled" : "published";
    const { error } = await ctx.supabase.from("announcements").update({ status }).eq("id", id);
    if (error) return { error: dbError(error) };
    await ctx.supabase.rpc("log_event", { p_action: "approve", p_entity: "announcements", p_entity_id: id });
    revalidatePath(`/announcements/${id}`);
    return { ok: true, message: status === "scheduled" ? "Đã duyệt, thông báo sẽ phát hành đúng lịch." : "Đã duyệt và phát hành." };
  }
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { error: "Nhập lý do trả lại." };
  const { error } = await ctx.supabase.from("announcements").update({ status: "draft", return_reason: reason.slice(0, 500) }).eq("id", id);
  if (error) return { error: dbError(error) };
  await ctx.supabase.rpc("log_event", { p_action: "return", p_entity: "announcements", p_entity_id: id });
  revalidatePath(`/announcements/${id}`);
  return { ok: true, message: "Đã trả lại cho người soạn." };
}

export async function archiveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.composeAnnouncement);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const { error } = await ctx.supabase.from("announcements").update({ status: "archived" }).eq("id", id);
  if (error) return { error: dbError(error) };
  revalidatePath(`/announcements/${id}`);
  return { ok: true, message: "Đã thu hồi / lưu trữ thông báo." };
}

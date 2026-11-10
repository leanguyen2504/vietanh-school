import "server-only";
import type { Ctx } from "@/lib/auth";

export async function uploadFile(ctx: Ctx, file: File, prefix: "library" | "announcements") {
  const { data: settings } = await ctx.supabase.from("app_settings").select("key, value").in("key", ["document_max_mb", "document_allowed_ext"]);
  const maxMb = Number(settings?.find((s: any) => s.key === "document_max_mb")?.value ?? 10);
  const allowed: string[] = (settings?.find((s: any) => s.key === "document_allowed_ext")?.value as any) ?? ["pdf"];
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!allowed.includes(ext)) return { error: `Loại tệp .${ext} không được phép. Cho phép: ${allowed.join(", ")}` };
  if (file.size > maxMb * 1024 * 1024) return { error: `Tệp vượt quá ${maxMb}MB.` };
  const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const path = `${prefix}/${crypto.randomUUID()}-${safe}`;
  const { error } = await ctx.supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { error: "Không tải được tệp lên: " + error.message };
  return { path, ext, size: file.size, mime: file.type };
}

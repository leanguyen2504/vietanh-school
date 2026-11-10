import { NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  // RLS trên bảng documents và storage.objects quyết định quyền xem
  const { data } = await ctx.supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Không tìm thấy tài liệu hoặc không có quyền" }, { status: 404 });
  const { data: signed, error } = await ctx.supabase.storage.from("documents").createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (error || !signed) return NextResponse.json({ error: "Không có quyền tải tệp" }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}

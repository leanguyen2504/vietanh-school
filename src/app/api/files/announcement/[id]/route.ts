import { NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  const { data } = await ctx.supabase.from("announcements").select("attachment_path").eq("id", id).maybeSingle();
  if (!data?.attachment_path) return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404 });
  const { data: signed, error } = await ctx.supabase.storage.from("documents").createSignedUrl(data.attachment_path, 60);
  if (error || !signed) return NextResponse.json({ error: "Không có quyền tải tệp" }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}

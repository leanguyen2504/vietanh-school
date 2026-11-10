import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Mở thông báo: đánh dấu đã đọc rồi chuyển tới trang liên quan */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(new URL("/notifications", req.url));
  const { data } = await supabase.from("notifications").select("link, read_at").eq("id", id).single();
  if (data && !data.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  const link = data?.link && data.link.startsWith("/") && !data.link.startsWith("//") ? data.link : "/notifications";
  return NextResponse.redirect(new URL(link, req.url));
}

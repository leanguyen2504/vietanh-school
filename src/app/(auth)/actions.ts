"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth";

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({
    email: fd.get("email"), password: fd.get("password"),
  });
  if (!parsed.success) return { error: "Vui lòng nhập email và mật khẩu hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email hoặc mật khẩu không đúng." };
  redirect("/");
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = z.string().email().safeParse(fd.get("email"));
  if (!email.success) return { error: "Email không hợp lệ." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await siteUrl()}/auth/callback?next=/auth/reset` });
  // Luôn trả cùng một thông điệp để không lộ email nào có tài khoản
  return { ok: true, message: "Nếu email có tài khoản, hệ thống đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư." };
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const pw = String(fd.get("password") ?? "");
  const pw2 = String(fd.get("password2") ?? "");
  if (pw.length < 8) return { error: "Mật khẩu cần ít nhất 8 ký tự." };
  if (pw !== pw2) return { error: "Hai mật khẩu không khớp." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu liên kết mới." };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: "Không đổi được mật khẩu: " + error.message };
  return { ok: true, message: "Đã đổi mật khẩu thành công." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

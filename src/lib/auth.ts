import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, MODULE_ACCESS, type AppRole, type ModuleKey } from "@/lib/roles";

export type Year = { id: string; name: string; status: string; start_date: string; end_date: string };

export type Ctx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  staffId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  years: Year[];
  year: Year | null;
};

export const getCtx = cache(async (): Promise<Ctx> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, staff_id, staff:staff_id(department_id, departments(name))")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !profile.role) redirect("/auth/pending");
  if (profile.role === "parent") redirect("/auth/pending");

  const { data: years } = await supabase
    .from("academic_years")
    .select("id, name, status, start_date, end_date")
    .order("start_date", { ascending: false });

  const cookieStore = await cookies();
  const chosen = cookieStore.get("year_id")?.value;
  const list = (years ?? []) as Year[];
  const year = list.find((y) => y.id === chosen) ?? list.find((y) => y.status === "active") ?? list[0] ?? null;
  const staff = (profile as any).staff;

  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? user.email ?? "",
    role: profile.role as AppRole,
    staffId: profile.staff_id,
    departmentId: staff?.department_id ?? null,
    departmentName: staff?.departments?.name ?? null,
    years: list,
    year,
  };
});

/** Dùng trong trang: chặn vai trò không được phép vào module */
export async function requireModule(m: ModuleKey) {
  const ctx = await getCtx();
  if (!can(ctx.role, MODULE_ACCESS[m])) redirect("/?denied=1");
  return ctx;
}

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: any };

/** Dùng trong server action: trả lỗi thay vì chuyển hướng */
export async function guard(roles: AppRole[]): Promise<Ctx | ActionState> {
  const ctx = await getCtx();
  if (!can(ctx.role, roles)) return { error: "Bạn không có quyền thực hiện thao tác này." };
  return ctx;
}

export function isErr(x: Ctx | ActionState): x is ActionState {
  return !("supabase" in x);
}

/** Thông điệp lỗi thân thiện từ lỗi Postgres/Supabase */
export function dbError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return "Đã xảy ra lỗi.";
  if (e.code === "23505") return "Dữ liệu bị trùng (mã hoặc tên đã tồn tại).";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "Bạn không có quyền thực hiện thao tác này.";
  if (e.code === "23503") return "Dữ liệu liên quan không tồn tại hoặc đang được sử dụng.";
  return e.message ?? "Đã xảy ra lỗi.";
}

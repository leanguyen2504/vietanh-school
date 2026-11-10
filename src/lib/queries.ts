import "server-only";
import type { Ctx } from "@/lib/auth";

export type ClassOpt = { id: string; name: string; grade_id: string; grade_number: number; grade_name: string; level_code: string; status: string };

export async function classesForYear(ctx: Ctx, opts: { onlyActive?: boolean } = {}): Promise<ClassOpt[]> {
  if (!ctx.year) return [];
  let q = ctx.supabase
    .from("classes")
    .select("id, name, status, grade_id, grades(name, grade_number, school_levels(code))")
    .eq("academic_year_id", ctx.year.id);
  if (opts.onlyActive) q = q.eq("status", "active");
  const { data } = await q;
  return ((data ?? []) as any[])
    .map((c) => ({
      id: c.id, name: c.name, status: c.status, grade_id: c.grade_id,
      grade_number: c.grades?.grade_number ?? 0, grade_name: c.grades?.name ?? "", level_code: c.grades?.school_levels?.code ?? "",
    }))
    .sort((a, b) => a.grade_number - b.grade_number || a.name.localeCompare(b.name, "vi"));
}

export async function myClassIds(ctx: Ctx): Promise<string[]> {
  if (!ctx.staffId || !ctx.year) return [];
  const [{ data: ta }, { data: hr }] = await Promise.all([
    ctx.supabase.from("teaching_assignments").select("class_id").eq("staff_id", ctx.staffId).eq("academic_year_id", ctx.year.id),
    ctx.supabase.from("classes").select("id").eq("homeroom_staff_id", ctx.staffId).eq("academic_year_id", ctx.year.id),
  ]);
  return Array.from(new Set([...(ta ?? []).map((r: any) => r.class_id), ...(hr ?? []).map((r: any) => r.id)]));
}

export async function staffProfiles(ctx: Ctx) {
  const { data } = await ctx.supabase.from("profiles").select("id, full_name, role").eq("is_active", true).neq("role", "parent").order("full_name");
  return (data ?? []) as { id: string; full_name: string; role: string }[];
}

export function cleanSearch(q?: string) {
  return (q ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
}

export const PAGE_SIZE = 20;
export function pageOf(p?: string) {
  const n = Number(p);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function isReadOnlyYear(ctx: Ctx) {
  return !!ctx.year && (ctx.year.status === "locked" || ctx.year.status === "archived");
}

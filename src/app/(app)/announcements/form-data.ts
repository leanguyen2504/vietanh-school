import "server-only";
import type { Ctx } from "@/lib/auth";
import { classesForYear } from "@/lib/queries";
import { can, PERMS } from "@/lib/roles";

export async function announcementFormData(ctx: Ctx) {
  const [{ data: levels }, classes, { data: departments }, { data: setting }] = await Promise.all([
    ctx.supabase.from("school_levels").select("id, name").eq("is_active", true).order("sort_order"),
    classesForYear(ctx, { onlyActive: true }),
    ctx.supabase.from("departments").select("id, name").order("name"),
    ctx.supabase.from("app_settings").select("value").eq("key", "announcement_requires_approval").maybeSingle(),
  ]);
  return {
    levels: levels ?? [], classes: classes.map((c) => ({ id: c.id, name: `Lớp ${c.name}` })), departments: departments ?? [],
    canPublish: can(ctx.role, PERMS.approveAnnouncement) || setting?.value === false,
  };
}

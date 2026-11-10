import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { toVNLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { AnnouncementForm } from "../../announcement-form";
import { announcementFormData } from "../../form-data";

export default async function EditAnnouncement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireModule("announcements");
  if (!can(ctx.role, PERMS.composeAnnouncement)) redirect("/announcements");
  const { data: a } = await ctx.supabase.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  if (!["draft", "pending"].includes(a.status)) redirect(`/announcements/${id}`);
  const d = await announcementFormData(ctx);
  return (
    <>
      <PageHeader title="Sửa thông báo" />
      <div className="rounded-xl border border-line bg-surface p-4">
        <AnnouncementForm a={a} {...d} publishAtLocal={toVNLocalInput(a.publish_at)} expiresAtLocal={toVNLocalInput(a.expires_at)} />
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import { AnnouncementForm } from "../announcement-form";
import { announcementFormData } from "../form-data";

export default async function NewAnnouncement() {
  const ctx = await requireModule("announcements");
  if (!can(ctx.role, PERMS.composeAnnouncement)) redirect("/announcements");
  const d = await announcementFormData(ctx);
  return (
    <>
      <PageHeader title="Soạn thông báo" description={d.canPublish ? "Bạn có quyền phát hành trực tiếp." : "Thông báo cần Ban Giám hiệu duyệt trước khi phát hành."} />
      <div className="rounded-xl border border-line bg-surface p-4"><AnnouncementForm {...d} /></div>
    </>
  );
}

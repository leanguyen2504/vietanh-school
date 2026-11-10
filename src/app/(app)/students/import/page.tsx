import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const ctx = await requireModule("students");
  if (!can(ctx.role, PERMS.manageStudents)) redirect("/students");
  return (
    <>
      <PageHeader title="Nhập học sinh từ CSV" description={`Nhập vào năm học ${ctx.year?.name ?? ""}. Hệ thống kiểm tra trùng mã và cho xem trước trước khi nhập.`} />
      <ImportClient />
    </>
  );
}

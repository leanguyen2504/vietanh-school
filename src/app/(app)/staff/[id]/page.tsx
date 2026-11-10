import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { STAFF_STATUS } from "@/lib/labels";
import { Badge, Card, PageHeader } from "@/components/ui";
import { StaffForm } from "../staff-form";

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireModule("staff");
  const { supabase } = ctx;
  const { data: s } = await supabase.from("staff").select("*, departments(name)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: departments }, { data: ta }] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("teaching_assignments").select("id, subject, is_homeroom, academic_years(name), classes(id, name)").eq("staff_id", id),
  ]);
  return (
    <>
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Nhân sự</Link>
      <PageHeader title={s.full_name} description={`${s.code} · ${s.departments?.name ?? "Chưa có bộ phận"} · ${s.position ?? ""}`} actions={<Badge tone={s.status === "working" ? "success" : "neutral"}>{STAFF_STATUS[s.status]}</Badge>} />
      <div className="space-y-4">
        {can(ctx.role, PERMS.manageStaff) && <Card title="Hồ sơ"><StaffForm s={s} departments={departments ?? []} /></Card>}
        <Card title="Phân công chủ nhiệm / giảng dạy">
          {!ta?.length ? <p className="text-sm text-muted">Chưa có phân công. Phân công được thực hiện trong trang chi tiết lớp.</p> : (
            <ul className="space-y-1 text-sm">
              {ta.map((a: any) => (
                <li key={a.id}>Năm {a.academic_years?.name} · <Link className="link" href={`/classes/${a.classes?.id}`}>Lớp {a.classes?.name}</Link> · {a.subject} {a.is_homeroom && <Badge tone="brand">Chủ nhiệm</Badge>}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

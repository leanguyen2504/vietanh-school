import Link from "next/link";
import { Download } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { cleanSearch, pageOf, PAGE_SIZE } from "@/lib/queries";
import { STAFF_STATUS } from "@/lib/labels";
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, btn } from "@/components/ui";
import { StaffForm } from "./staff-form";

type SP = { q?: string; dept?: string; status?: string; page?: string };

export default async function StaffPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireModule("staff");
  const { supabase } = ctx;
  const page = pageOf(sp.page);
  const q = cleanSearch(sp.q);
  const { data: departments } = await supabase.from("departments").select("id, name").order("name");

  let query = supabase.from("staff").select("id, code, full_name, work_email, work_phone, position, status, departments(name)", { count: "exact" });
  if (q) query = query.or(`full_name.ilike.%${q}%,code.ilike.%${q}%`);
  if (sp.dept) query = query.eq("department_id", sp.dept);
  query = query.eq("status", (sp.status as any) || "working");
  const { data, count, error } = await query.order("full_name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const manage = can(ctx.role, PERMS.manageStaff);
  const exportQs = new URLSearchParams(Object.entries({ q, dept: sp.dept, status: sp.status }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Giáo viên & nhân sự"
        description="Chỉ lưu thông tin liên hệ công vụ. Không lưu lương, giấy tờ định danh ở giai đoạn này."
        actions={can(ctx.role, PERMS.exportPersonal) && <a className={btn("secondary")} href={`/api/export/staff?${exportQs}`}><Download className="h-4 w-4" /> Xuất CSV</a>}
      />
      {manage && (
        <details className="mb-4 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium text-brand-dark">+ Thêm nhân sự</summary>
          <div className="mt-3"><StaffForm departments={departments ?? []} /></div>
        </details>
      )}
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-4" role="search">
          <input name="q" defaultValue={q} placeholder="Tìm theo họ tên hoặc mã" className="input sm:col-span-2" aria-label="Tìm kiếm" />
          <select name="dept" defaultValue={sp.dept ?? ""} className="input" aria-label="Tổ/bộ phận"><option value="">Tất cả tổ/bộ phận</option>{(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="flex gap-2">
            <select name="status" defaultValue={sp.status ?? "working"} className="input" aria-label="Trạng thái">{Object.entries(STAFF_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className={btn("primary")}>Lọc</button>
          </div>
        </form>
        {error ? <Alert tone="danger">Không tải được: {error.message}</Alert> : !data?.length ? <EmptyState title="Không có nhân sự phù hợp" /> : (
          <>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Mã</th><th>Họ tên</th><th>Tổ / bộ phận</th><th>Chức vụ</th><th>Liên hệ công vụ</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {data.map((s: any) => (
                    <tr key={s.id} className="hover:bg-page">
                      <td className="font-mono text-xs">{s.code}</td>
                      <td><Link className="link" href={`/staff/${s.id}`}>{s.full_name}</Link></td>
                      <td>{s.departments?.name ?? "—"}</td>
                      <td>{s.position ?? "—"}</td>
                      <td className="text-muted">{[s.work_email, s.work_phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td><Badge tone={s.status === "working" ? "success" : "neutral"}>{STAFF_STATUS[s.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={sp as any} />
          </>
        )}
      </Card>
    </>
  );
}

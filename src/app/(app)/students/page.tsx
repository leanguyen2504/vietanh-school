import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { classesForYear, cleanSearch, pageOf, PAGE_SIZE } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { STUDENT_STATUS } from "@/lib/labels";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader, Pagination, TableWrap, btn } from "@/components/ui";

type SP = { q?: string; class?: string; grade?: string; status?: string; page?: string; sort?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireModule("students");
  const { supabase, year, role } = ctx;
  if (!year) return <EmptyState title="Chưa có năm học" />;

  const classes = await classesForYear(ctx);
  const grades = Array.from(new Map(classes.map((c) => [c.grade_id, c.grade_name])).entries());
  const page = pageOf(sp.page);
  const q = cleanSearch(sp.q);

  let query = supabase
    .from("students")
    .select("id, code, full_name, date_of_birth, gender, status, enrollments!inner(status, academic_year_id, class_id, classes!inner(name, grade_id))", { count: "exact" })
    .eq("enrollments.academic_year_id", year.id);
  if (q) query = query.or(`full_name.ilike.%${q}%,code.ilike.%${q}%`);
  if (sp.class) query = query.eq("enrollments.class_id", sp.class);
  if (sp.grade) query = query.eq("enrollments.classes.grade_id", sp.grade);
  if (sp.status) query = query.eq("status", sp.status);
  else query = query.eq("enrollments.status", "active");
  const sort = sp.sort === "code" ? "code" : "full_name";
  const { data, count, error } = await query.order(sort).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const exportQs = new URLSearchParams(Object.entries({ q, class: sp.class, grade: sp.grade, status: sp.status }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Học sinh"
        description={`Năm học ${year.name}. ${role === "teacher" ? "Chỉ hiển thị học sinh các lớp bạn được phân công." : ""}`}
        actions={
          <>
            {can(role, PERMS.exportPersonal) && (
              <a className={btn("secondary")} href={`/api/export/students?${exportQs}`}><Download className="h-4 w-4" /> Xuất CSV</a>
            )}
            {can(role, PERMS.manageStudents) && (
              <>
                <ButtonLink href="/students/import" variant="secondary"><Upload className="h-4 w-4" /> Nhập CSV</ButtonLink>
                <ButtonLink href="/students/new"><Plus className="h-4 w-4" /> Thêm học sinh</ButtonLink>
              </>
            )}
          </>
        }
      />
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" role="search">
          <input name="q" defaultValue={q} placeholder="Tìm theo họ tên hoặc mã học sinh" className="input lg:col-span-2" aria-label="Tìm kiếm" />
          <select name="grade" defaultValue={sp.grade ?? ""} className="input" aria-label="Khối">
            <option value="">Tất cả khối</option>
            {grades.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select name="class" defaultValue={sp.class ?? ""} className="input" aria-label="Lớp">
            <option value="">Tất cả lớp</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Trạng thái">
            <option value="">Đang ghi danh</option>
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <select name="sort" defaultValue={sp.sort ?? ""} className="input" aria-label="Sắp xếp">
              <option value="">Theo tên</option>
              <option value="code">Theo mã</option>
            </select>
            <button className={btn("primary")}>Lọc</button>
          </div>
        </form>

        {error ? (
          <Alert tone="danger">Không tải được danh sách: {error.message}. <Link className="link" href="/students">Thử lại</Link></Alert>
        ) : !data?.length ? (
          <EmptyState title="Không tìm thấy học sinh" description="Thử bỏ bớt bộ lọc hoặc kiểm tra năm học đang chọn." />
        ) : (
          <>
            <TableWrap>
              <table className="table hidden md:table">
                <thead>
                  <tr><th>Mã HS</th><th>Họ tên</th><th>Ngày sinh</th><th>Lớp</th><th>Trạng thái</th></tr>
                </thead>
                <tbody>
                  {data.map((s: any) => (
                    <tr key={s.id} className="hover:bg-page">
                      <td className="font-mono text-xs">{s.code}</td>
                      <td><Link className="link" href={`/students/${s.id}`}>{s.full_name}</Link></td>
                      <td>{fmtDate(s.date_of_birth)}</td>
                      <td>{s.enrollments?.map((e: any) => e.classes?.name).join(", ")}</td>
                      <td><Badge tone={s.status === "studying" ? "success" : "neutral"}>{STUDENT_STATUS[s.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <ul className="space-y-2 md:hidden">
              {data.map((s: any) => (
                <li key={s.id}>
                  <Link href={`/students/${s.id}`} className="block rounded-lg border border-line p-3">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{s.full_name}</span>
                      <Badge tone={s.status === "studying" ? "success" : "neutral"}>{STUDENT_STATUS[s.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{s.code} · Lớp {s.enrollments?.map((e: any) => e.classes?.name).join(", ")} · {fmtDate(s.date_of_birth)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={sp as any} />
          </>
        )}
      </Card>
    </>
  );
}

import { FileText } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { cleanSearch } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { DOC_ACCESS, DOC_TYPES } from "@/lib/labels";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, TableWrap, btn } from "@/components/ui";
import { deleteDocument, uploadDocument } from "./actions";

const size = (b?: number) => (!b ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; dept?: string; year?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("documents");
  const q = cleanSearch(sp.q);
  const [{ data: departments }, { data: settings }] = await Promise.all([
    ctx.supabase.from("departments").select("id, name").order("name"),
    ctx.supabase.from("app_settings").select("key, value").in("key", ["document_max_mb", "document_allowed_ext"]),
  ]);
  let query = ctx.supabase.from("documents").select("id, title, doc_type, access_level, file_name, size_bytes, created_at, uploaded_by, departments(name), academic_years(name), profiles:uploaded_by(full_name)");
  if (q) query = query.ilike("title", `%${q}%`);
  if (sp.type) query = query.eq("doc_type", sp.type);
  if (sp.dept) query = query.eq("department_id", sp.dept);
  if (sp.year !== "all" && ctx.year) query = query.eq("academic_year_id", ctx.year.id);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  const upload = can(ctx.role, PERMS.uploadDocuments);
  const maxMb = settings?.find((s: any) => s.key === "document_max_mb")?.value;
  const exts = (settings?.find((s: any) => s.key === "document_allowed_ext")?.value as string[] | undefined)?.join(", ");

  return (
    <>
      <PageHeader title="Thư viện tài liệu" description="Tài liệu được lưu riêng tư; liên kết tải về chỉ có hiệu lực trong 60 giây." />
      {upload && (
        <details className="mb-4 rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium text-brand-dark">+ Tải tài liệu lên</summary>
          <ActionForm action={uploadDocument} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tiêu đề *"><input name="title" required className="input" /></Field>
            <Field label="Loại văn bản"><select name="doc_type" className="input">{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Mức truy cập"><select name="access_level" className="input">{Object.entries(DOC_ACCESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {ctx.role !== "head" && <Field label="Tổ / bộ phận"><select name="department_id" className="input"><option value="">—</option>{(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}
            <Field label="Tệp *" hint={`Tối đa ${maxMb ?? 10}MB · ${exts ?? ""}`}><input type="file" name="file" required className="text-sm" /></Field>
            <div className="flex items-end"><SubmitButton pendingText="Đang tải lên…">Tải lên</SubmitButton></div>
          </ActionForm>
        </details>
      )}
      <Card>
        <form className="mb-4 grid gap-2 sm:grid-cols-5">
          <input name="q" defaultValue={q} placeholder="Tìm theo tiêu đề" className="input sm:col-span-2" aria-label="Tìm kiếm" />
          <select name="type" defaultValue={sp.type ?? ""} className="input" aria-label="Loại"><option value="">Mọi loại</option>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select name="dept" defaultValue={sp.dept ?? ""} className="input" aria-label="Bộ phận"><option value="">Mọi bộ phận</option>{(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <div className="flex gap-2">
            <select name="year" defaultValue={sp.year ?? ""} className="input" aria-label="Năm học"><option value="">Năm đang chọn</option><option value="all">Mọi năm</option></select>
            <button className={btn("primary")}>Lọc</button>
          </div>
        </form>
        {error ? <Alert tone="danger">Không tải được: {error.message}</Alert> : !data?.length ? <EmptyState title="Chưa có tài liệu" /> : (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Tài liệu</th><th>Loại</th><th>Bộ phận</th><th>Truy cập</th><th>Kích thước</th><th>Ngày</th><th></th></tr></thead>
              <tbody>
                {data.map((d: any) => (
                  <tr key={d.id}>
                    <td><a className="link inline-flex items-center gap-1" href={`/api/files/document/${d.id}`}><FileText className="h-4 w-4" />{d.title}</a><p className="text-xs text-muted">{d.file_name} · {d.profiles?.full_name ?? "—"}</p></td>
                    <td>{d.doc_type}</td>
                    <td>{d.departments?.name ?? "—"}</td>
                    <td><Badge tone={d.access_level === "all_staff" ? "neutral" : "warning"}>{DOC_ACCESS[d.access_level]}</Badge></td>
                    <td className="whitespace-nowrap">{size(d.size_bytes)}</td>
                    <td className="whitespace-nowrap">{fmtDate(d.created_at)}</td>
                    <td>{(can(ctx.role, ["admin", "principal"]) || d.uploaded_by === ctx.userId) && <ActionButton action={deleteDocument} fields={{ id: d.id }} variant="ghost" confirm="Xóa vĩnh viễn tài liệu này?">Xóa</ActionButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

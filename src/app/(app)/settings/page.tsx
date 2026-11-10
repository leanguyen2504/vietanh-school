import Link from "next/link";
import clsx from "clsx";
import { requireModule } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { YEAR_STATUS } from "@/lib/labels";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, PageHeader, TableWrap } from "@/components/ui";
import { addDepartment, createYear, inviteUser, setYearStatus, toggleLevel, updateSetting, updateUser } from "./actions";

const TABS = [
  { k: "years", label: "Năm học & cấp học" },
  { k: "users", label: "Tài khoản & vai trò" },
  { k: "departments", label: "Tổ / bộ phận" },
  { k: "system", label: "Cấu hình chung" },
  { k: "audit", label: "Nhật ký hệ thống" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("settings");
  const tab = TABS.some((t) => t.k === sp.tab) ? sp.tab! : "years";
  const s = ctx.supabase;

  return (
    <>
      <PageHeader title="Cấu hình hệ thống" description="Chỉ quản trị viên truy cập được trang này." />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <Link key={t.k} href={`?tab=${t.k}`} role="tab" aria-selected={tab === t.k} className={clsx("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === t.k ? "border-brand text-brand-dark" : "border-transparent text-muted hover:text-ink")}>{t.label}</Link>
        ))}
      </div>
      {tab === "years" && <Years ctx={ctx} />}
      {tab === "users" && <Users s={s} me={ctx.userId} />}
      {tab === "departments" && <Departments s={s} />}
      {tab === "system" && <System s={s} />}
      {tab === "audit" && <Audit s={s} />}
    </>
  );
}

async function Years({ ctx }: { ctx: any }) {
  const { data: levels } = await ctx.supabase.from("school_levels").select("*").order("sort_order");
  const years = ctx.years as any[];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Năm học" className="lg:col-span-2">
        <TableWrap>
          <table className="table">
            <thead><tr><th>Năm học</th><th>Thời gian</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td className="font-medium">{y.name}</td>
                  <td className="whitespace-nowrap">{fmtDate(y.start_date)} – {fmtDate(y.end_date)}</td>
                  <td><Badge tone={y.status === "active" ? "success" : y.status === "draft" ? "warning" : "neutral"}>{YEAR_STATUS[y.status]}</Badge></td>
                  <td className="flex flex-wrap gap-1">
                    {y.status !== "active" && y.status !== "archived" && <ActionButton action={setYearStatus} fields={{ id: y.id, status: "active" }} confirm={`Kích hoạt năm học ${y.name}? Năm học đang hoạt động sẽ chuyển sang khóa (chỉ đọc).`}>Kích hoạt</ActionButton>}
                    {y.status === "active" && <ActionButton action={setYearStatus} fields={{ id: y.id, status: "locked" }} confirm="Khóa năm học (chỉ đọc)?">Khóa</ActionButton>}
                    {y.status === "locked" && <ActionButton action={setYearStatus} fields={{ id: y.id, status: "archived" }} confirm="Chuyển năm học sang lưu trữ?">Lưu trữ</ActionButton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <h3 className="mb-2 mt-6 font-semibold">Tạo năm học mới</h3>
        <ActionForm action={createYear} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tên"><input name="name" placeholder="2027-2028" required className="input" /></Field>
          <Field label="Bắt đầu"><input type="date" name="start_date" required className="input" /></Field>
          <Field label="Kết thúc"><input type="date" name="end_date" required className="input" /></Field>
          <Field label="Sao chép lớp từ"><select name="copy_from" className="input"><option value="">Không sao chép</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
          <div><SubmitButton>Tạo năm học</SubmitButton></div>
        </ActionForm>
        <p className="mt-2 text-xs text-muted">Quy trình: tạo bản nháp → sao chép khối/lớp → kiểm tra lớp, GVCN, phân công → chuyển học sinh lên lớp → kích hoạt. Năm cũ tự chuyển sang chỉ đọc.</p>
      </Card>
      <Card title="Cấp học">
        <ul className="space-y-2 text-sm">
          {(levels ?? []).map((l: any) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span>{l.name} <Badge tone={l.is_active ? "success" : "neutral"}>{l.is_active ? "Đang vận hành" : "Chưa bật"}</Badge></span>
              <ActionButton action={toggleLevel} fields={{ id: l.id, active: String(!l.is_active) }} variant="ghost" confirm={l.is_active ? `Tắt cấp ${l.name}?` : `Bật cấp ${l.name}? Chỉ bật khi nhà trường đã xác nhận.`}>{l.is_active ? "Tắt" : "Bật"}</ActionButton>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">THPT để sẵn trong dữ liệu, chưa bật cho đến khi nhà trường xác nhận.</p>
      </Card>
    </div>
  );
}

async function Users({ s, me }: { s: any; me: string }) {
  const [{ data: users }, { data: staff }] = await Promise.all([
    s.from("profiles").select("id, email, full_name, role, is_active, staff_id, created_at").order("created_at", { ascending: false }),
    s.from("staff").select("id, full_name, code").order("full_name"),
  ]);
  return (
    <div className="space-y-4">
      <Card title="Mời tài khoản mới">
        <ActionForm action={inviteUser} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          <Field label="Email"><input type="email" name="email" required className="input" /></Field>
          <Field label="Họ tên"><input name="full_name" className="input" /></Field>
          <div className="flex items-end"><SubmitButton>Gửi lời mời</SubmitButton></div>
        </ActionForm>
        <p className="mt-2 text-xs text-muted">Mỗi người một tài khoản riêng, không dùng tài khoản chung. Tài khoản mới chưa có quyền cho đến khi được cấp vai trò và kích hoạt.</p>
      </Card>
      <Card title={`Tài khoản (${users?.length ?? 0})`}>
        <ul className="divide-y divide-line">
          {(users ?? []).map((u: any) => (
            <li key={u.id} className="py-3">
              <ActionForm action={updateUser} className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
                <input type="hidden" name="id" value={u.id} />
                <div className="text-sm">
                  <p className="font-medium">{u.full_name ?? "—"} {u.id === me && <Badge tone="brand">Bạn</Badge>}</p>
                  <p className="text-muted">{u.email}</p>
                </div>
                <select name="role" defaultValue={u.role ?? ""} className="input" aria-label="Vai trò" disabled={u.id === me}>
                  <option value="">Chưa cấp vai trò</option>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select name="staff_id" defaultValue={u.staff_id ?? ""} className="input" aria-label="Hồ sơ nhân sự">
                  <option value="">Không liên kết nhân sự</option>
                  {(staff ?? []).map((st: any) => <option key={st.id} value={st.id}>{st.full_name} ({st.code})</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={u.is_active} disabled={u.id === me} /> Kích hoạt</label>
                {u.id === me ? <><input type="hidden" name="role" value="admin" /><input type="hidden" name="is_active" value="on" /><SubmitButton variant="secondary">Lưu</SubmitButton></> : <SubmitButton variant="secondary">Lưu</SubmitButton>}
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

async function Departments({ s }: { s: any }) {
  const [{ data: deps }, { data: levels }] = await Promise.all([
    s.from("departments").select("id, code, name, school_levels(name)").order("name"),
    s.from("school_levels").select("id, name").order("sort_order"),
  ]);
  return (
    <Card title="Tổ / bộ phận">
      <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(deps ?? []).map((d: any) => <li key={d.id} className="rounded-lg border border-line p-3 text-sm"><span className="font-medium">{d.name}</span> <span className="text-muted">({d.code})</span>{d.school_levels && <p className="text-xs text-muted">Phụ trách cấp: {d.school_levels.name}</p>}</li>)}
      </ul>
      <ActionForm action={addDepartment} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
        <Field label="Mã"><input name="code" required className="input" /></Field>
        <Field label="Tên"><input name="name" required className="input" /></Field>
        <Field label="Gắn với cấp học" hint="Tổ trưởng xem được lớp thuộc cấp này"><select name="level_id" className="input"><option value="">—</option>{(levels ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <div className="flex items-end"><SubmitButton>Thêm</SubmitButton></div>
      </ActionForm>
    </Card>
  );
}

async function System({ s }: { s: any }) {
  const { data } = await s.from("app_settings").select("key, value");
  const v = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  return (
    <Card title="Cấu hình chung">
      <ActionForm action={updateSetting} className="max-w-xl space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcement_requires_approval" defaultChecked={v.announcement_requires_approval !== false} /> Thông báo cần Ban Giám hiệu duyệt trước khi phát hành</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="attendance_edit_requires_reason" defaultChecked={v.attendance_edit_requires_reason !== false} /> Sửa điểm danh sau khi xác nhận phải nhập lý do</label>
        <Field label="Dung lượng tệp tối đa (MB)"><input type="number" name="document_max_mb" min={1} max={50} defaultValue={v.document_max_mb ?? 10} className="input w-32" /></Field>
        <Field label="Định dạng tệp cho phép" hint="Phân cách bằng dấu phẩy"><input name="document_allowed_ext" defaultValue={(v.document_allowed_ext ?? []).join(", ")} className="input" /></Field>
        <p className="text-sm text-muted">Cổng phụ huynh: <Badge>{v.parent_portal_enabled ? "Đang bật" : "Chưa bật"}</Badge> (bật sau khi nhà trường xác nhận quy trình xác minh phụ huynh).</p>
        <SubmitButton>Lưu cấu hình</SubmitButton>
      </ActionForm>
    </Card>
  );
}

const ACTIONS: Record<string, string> = { insert: "Tạo", update: "Sửa", delete: "Xóa", export: "Xuất dữ liệu", import: "Nhập dữ liệu", approve: "Duyệt", return: "Trả lại", invite: "Mời tài khoản", edit_after_confirm: "Sửa sau xác nhận" };

async function Audit({ s }: { s: any }) {
  const { data: logs } = await s.from("audit_logs").select("id, actor_id, action, entity, entity_id, detail, created_at").order("created_at", { ascending: false }).limit(200);
  const ids = Array.from(new Set((logs ?? []).map((l: any) => l.actor_id).filter(Boolean)));
  const { data: people } = ids.length ? await s.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map<string, string>((people ?? []).map((p: any) => [p.id, p.full_name]));
  return (
    <Card title="200 sự kiện gần nhất">
      <TableWrap>
        <table className="table">
          <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
          <tbody>
            {(logs ?? []).map((l: any) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                <td>{l.actor_id ? names.get(l.actor_id) ?? "—" : "Hệ thống"}</td>
                <td>{ACTIONS[l.action] ?? l.action}</td>
                <td className="font-mono text-xs">{l.entity}</td>
                <td className="max-w-xs truncate text-xs text-muted">{l.detail ? JSON.stringify(l.detail) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

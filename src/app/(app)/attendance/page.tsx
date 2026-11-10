import Link from "next/link";
import { requireModule } from "@/lib/auth";
import { can, PERMS } from "@/lib/roles";
import { myClassIds } from "@/lib/queries";
import { addDays, fmtDate, todayVN } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader, TableWrap, btn } from "@/components/ui";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireModule("attendance");
  const { supabase, year } = ctx;
  if (!year) return <EmptyState title="Chưa có năm học" />;
  const today = todayVN();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;

  const [{ data, error }, mine] = await Promise.all([
    supabase.rpc("report_attendance_day", { p_year: year.id, p_date: date }),
    myClassIds(ctx),
  ]);
  const rows = ((data ?? []) as any[]);
  const overview = can(ctx.role, PERMS.attendanceOverview);
  const visible = overview ? rows : rows.filter((r) => mine.includes(r.class_id));
  const done = visible.filter((r) => r.session_status === "confirmed").length;
  const canTake = (cid: string) => can(ctx.role, ["admin", "principal"]) || mine.includes(cid);

  return (
    <>
      <PageHeader
        title="Điểm danh"
        description={overview ? "Tình trạng hoàn thành điểm danh theo lớp." : "Các lớp bạn được phân công."}
      />
      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <Link className={btn("secondary")} href={`?date=${addDays(date, -1)}`} aria-label="Ngày trước">‹</Link>
          <label className="text-sm">
            <span className="sr-only">Ngày</span>
            <input type="date" name="date" defaultValue={date} max={today} className="input" />
          </label>
          {date < today && <Link className={btn("secondary")} href={`?date=${addDays(date, 1)}`} aria-label="Ngày sau">›</Link>}
          <button className={btn("primary")}>Xem</button>
          <span className="ml-auto text-sm text-muted">{fmtDate(date)} · <strong className="text-ink">{done}/{visible.length}</strong> lớp đã xác nhận</span>
        </form>
        {error ? <Alert tone="danger">Không tải được: {error.message}</Alert> : visible.length === 0 ? (
          <EmptyState title="Không có lớp" description="Bạn chưa được phân công lớp nào trong năm học này." />
        ) : (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Lớp</th><th>Tình trạng</th><th>Có mặt</th><th>Nghỉ có phép</th><th>Nghỉ không phép</th><th>Đi muộn</th><th></th></tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.class_id}>
                    <td className="font-medium">{r.class_name}</td>
                    <td>
                      {r.session_status === "confirmed" ? <Badge tone="success">✓ Đã xác nhận</Badge>
                        : r.session_status === "draft" ? <Badge tone="warning">● Đang nháp</Badge>
                        : <Badge tone="danger">! Chưa điểm danh</Badge>}
                    </td>
                    <td>{r.present}</td><td>{r.excused}</td><td>{r.unexcused}</td><td>{r.late}</td>
                    <td className="text-right">
                      <Link className="link" href={`/attendance/take?class=${r.class_id}&date=${date}`}>
                        {canTake(r.class_id) ? (r.session_status === "missing" ? "Điểm danh" : "Mở / sửa") : "Xem"}
                      </Link>
                    </td>
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

import Link from "next/link";
import clsx from "clsx";
import { getCtx } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { markAllRead } from "./actions";

export default async function NotificationsPage() {
  const ctx = await getCtx();
  const { data, error } = await ctx.supabase
    .from("notifications")
    .select("id, title, body, link, created_at, read_at")
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (data ?? []) as any[];
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title="Thông báo hệ thống"
        description="Thông báo tự động khi có thay đổi liên quan đến bạn (100 thông báo gần nhất). Chưa gửi qua email hay Zalo."
        actions={unread > 0 && <ActionForm action={markAllRead}><SubmitButton variant="secondary" pendingText="Đang cập nhật…">Đánh dấu đã đọc tất cả</SubmitButton></ActionForm>}
      />
      <Card>
        {error ? <p className="text-sm text-danger">Không tải được thông báo: {error.message}</p> : !list.length ? (
          <EmptyState title="Chưa có thông báo" description="Ví dụ: Ban Giám hiệu nhận thông báo khi Chủ đầu tư thay đổi dữ liệu; Chủ đầu tư nhận thông báo khi có khoản thu/chi chờ duyệt." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id}>
                <Link href={`/notifications/${n.id}`} className={clsx("flex gap-3 px-2 py-3 hover:bg-page", !n.read_at && "bg-brand-soft/40")}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} aria-hidden />
                  <span className="flex-1">
                    <span className={clsx("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fmtDateTime(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

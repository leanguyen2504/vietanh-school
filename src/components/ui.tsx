import Link from "next/link";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Inbox, Info, TriangleAlert } from "lucide-react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold text-ink">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const toneCls: Record<Tone, string> = {
  neutral: "bg-page text-muted border-line",
  brand: "bg-brand-soft text-brand-dark border-brand/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", toneCls[tone])}>{children}</span>;
}

export function ButtonLink({ href, children, variant = "primary", className }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return (
    <Link href={href} className={clsx(btn(variant), className)}>
      {children}
    </Link>
  );
}

export function btn(variant: "primary" | "secondary" | "danger" | "ghost" = "primary") {
  return clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
    variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
    variant === "secondary" && "border border-line bg-white text-ink hover:bg-page",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
    variant === "ghost" && "text-muted hover:bg-page hover:text-ink",
  );
}

export function EmptyState({ title = "Chưa có dữ liệu", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="h-8 w-8 text-muted" aria-hidden />
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: React.ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? AlertCircle : tone === "warning" ? TriangleAlert : Info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", toneCls[tone])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, href, icon }: { label: string; value: React.ReactNode; hint?: string; href?: string; icon?: React.ReactNode }) {
  const inner = (
    <div className="flex h-full items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-brand/40">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {icon && <div className="rounded-lg bg-brand-soft p-2 text-brand-dark">{icon}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Phân trang qua query string */
export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    sp.set("page", String(p));
    return "?" + sp.toString();
  };
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-muted">
      <span>
        {total} bản ghi · Trang {page}/{pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={btn("secondary")} href={href(page - 1)}>Trước</Link> : <span className={clsx(btn("secondary"), "opacity-50")}>Trước</span>}
        {page < pages ? <Link className={btn("secondary")} href={href(page + 1)}>Sau</Link> : <span className={clsx(btn("secondary"), "opacity-50")}>Sau</span>}
      </div>
    </div>
  );
}

/** Bảng có cuộn ngang rõ ràng trên điện thoại */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:thin]">{children}</div>;
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function DenyNotice() {
  return <Alert tone="warning">Bạn không có quyền truy cập chức năng đó. Liên hệ quản trị viên nếu cần cấp quyền.</Alert>;
}

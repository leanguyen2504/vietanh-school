import { Badge } from "@/components/ui";
import { TASK_STATUS } from "@/lib/labels";

export function TaskStatus({ status, due, today }: { status: string; due?: string | null; today: string }) {
  const overdue = status !== "done" && !!due && due < today;
  if (overdue) return <Badge tone="danger">! Quá hạn</Badge>;
  const tone = status === "done" ? "success" : status === "in_progress" ? "info" : status === "waiting" ? "warning" : "brand";
  return <Badge tone={tone as any}>{status === "done" ? "✓ " : ""}{TASK_STATUS[status]}</Badge>;
}

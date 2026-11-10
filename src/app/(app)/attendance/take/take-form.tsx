"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Alert, btn } from "@/components/ui";
import { saveAttendance } from "../actions";

type St = "present" | "excused" | "unexcused" | "late";
type Row = { id: string; code: string; name: string; status: St; reason: string };

const OPTS: { v: St; label: string; short: string; cls: string }[] = [
  { v: "present", label: "Có mặt", short: "CM", cls: "bg-success text-white border-success" },
  { v: "late", label: "Đi muộn", short: "M", cls: "bg-warning text-white border-warning" },
  { v: "excused", label: "Nghỉ có phép", short: "P", cls: "bg-info text-white border-info" },
  { v: "unexcused", label: "Nghỉ không phép", short: "K", cls: "bg-danger text-white border-danger" },
];

export function TakeForm({ classId, date, session, students, confirmed, readOnly }: {
  classId: string; date: string; session: string; students: Row[]; confirmed: boolean; readOnly: boolean;
}) {
  const [rows, setRows] = useState(students);
  const [editReason, setEditReason] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (id: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const counts = OPTS.map((o) => ({ ...o, n: rows.filter((r) => r.status === o.v).length }));

  function submit(confirm: boolean) {
    setMsg(null);
    if (confirmed && !editReason.trim()) {
      setMsg({ text: "Phiên đã xác nhận: vui lòng nhập lý do chỉnh sửa." });
      return;
    }
    start(async () => {
      const r = await saveAttendance({
        class_id: classId, date, session, confirm, reason: editReason || undefined,
        records: rows.map((x) => ({ student_id: x.id, status: x.status, reason: x.status === "present" ? undefined : x.reason || undefined })),
      });
      setMsg({ ok: !r.error, text: r.error ?? r.message ?? "" });
      if (!r.error) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
        {counts.map((c) => <span key={c.v} className="rounded-full bg-page px-2 py-0.5">{c.label}: <strong>{c.n}</strong></span>)}
        {!readOnly && (
          <button type="button" className={clsx(btn("secondary"), "ml-auto")} onClick={() => setRows((r) => r.map((x) => ({ ...x, status: "present", reason: "" })))}>
            Đánh dấu tất cả có mặt
          </button>
        )}
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <span className="mr-2 text-xs text-muted">{i + 1}.</span>
              <span className="font-medium">{r.name}</span> <span className="text-xs text-muted">{r.code}</span>
            </div>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Trạng thái của ${r.name}`}>
              {OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={r.status === o.v}
                  disabled={readOnly}
                  onClick={() => set(r.id, { status: o.v })}
                  className={clsx("rounded-lg border px-2.5 py-1.5 text-xs font-medium transition", r.status === o.v ? o.cls : "border-line bg-white text-muted hover:bg-page")}
                  title={o.label}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {r.status !== "present" && (
              <input
                className="input sm:w-56"
                placeholder="Lý do (nếu có)"
                value={r.reason}
                disabled={readOnly}
                maxLength={300}
                onChange={(e) => set(r.id, { reason: e.target.value })}
                aria-label={`Lý do của ${r.name}`}
              />
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-line bg-surface p-4 sm:mx-0 sm:rounded-xl sm:border">
          {confirmed && (
            <label className="block text-sm">
              <span className="label">Lý do chỉnh sửa sau khi đã xác nhận *</span>
              <input className="input" value={editReason} onChange={(e) => setEditReason(e.target.value)} maxLength={500} />
            </label>
          )}
          {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
          <div className="flex flex-wrap gap-2">
            {!confirmed && <button type="button" disabled={pending} className={btn("secondary")} onClick={() => submit(false)}>Lưu nháp</button>}
            <button type="button" disabled={pending} className={btn("primary")} onClick={() => submit(true)}>
              {pending ? "Đang lưu…" : confirmed ? "Lưu chỉnh sửa" : "Xác nhận hoàn tất"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

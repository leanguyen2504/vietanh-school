"use client";

import { useState, useTransition } from "react";
import { parseCSV } from "@/lib/format";
import { Alert, Badge, Card, TableWrap, btn } from "@/components/ui";
import { checkImport, importStudents, type ImportRow } from "../actions";

const HEADERS = ["ma_hoc_sinh", "ho_ten", "ngay_sinh", "gioi_tinh", "lop", "nguoi_giam_ho", "quan_he", "dien_thoai"];
const TEMPLATE = "﻿" + HEADERS.join(",") + "\nHS-0001,Nguyễn Văn Mẫu,2015-03-12,nam,6A1,Nguyễn Văn Bố,Bố,0900000000\n";

function normDate(v: string) {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s ? "invalid" : null;
}
function normGender(v: string) {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (["nam", "male", "m"].includes(s)) return "male";
  if (["nữ", "nu", "female", "f"].includes(s)) return "female";
  return "other";
}

export function ImportClient() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ message?: string; error?: string; failed?: string[] } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File) {
    setResult(null);
    if (f.size > 2 * 1024 * 1024) return setResult({ error: "Tệp quá lớn (tối đa 2MB)." });
    const table = parseCSV(await f.text());
    const [head, ...body] = table;
    const idx = (k: string) => head.findIndex((h) => h.trim().toLowerCase() === k);
    if (idx("ma_hoc_sinh") < 0 || idx("ho_ten") < 0) return setResult({ error: "Thiếu cột bắt buộc ma_hoc_sinh hoặc ho_ten. Hãy dùng tệp mẫu." });
    const parsed: ImportRow[] = body.map((r, i) => {
      const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "").trim() : "");
      const dob = normDate(get("ngay_sinh"));
      const row: ImportRow = {
        line: i + 2, code: get("ma_hoc_sinh"), full_name: get("ho_ten"), date_of_birth: dob === "invalid" ? null : dob,
        gender: normGender(get("gioi_tinh")), class_name: get("lop"), guardian_name: get("nguoi_giam_ho"),
        guardian_relationship: get("quan_he"), guardian_phone: get("dien_thoai"), errors: [],
      };
      if (!row.code) row.errors.push("Thiếu mã");
      if (row.full_name.length < 2) row.errors.push("Thiếu họ tên");
      if (dob === "invalid") row.errors.push("Ngày sinh sai định dạng");
      return row;
    });
    const seen = new Set<string>();
    parsed.forEach((r) => { if (seen.has(r.code)) r.errors.push("Trùng mã trong tệp"); seen.add(r.code); });
    const check = await checkImport(parsed.map((r) => r.code));
    const existing = new Set(check.existing);
    const classes = new Set(check.classes.map((c) => c.toLowerCase()));
    parsed.forEach((r) => {
      if (existing.has(r.code)) r.errors.push("Mã đã tồn tại");
      if (r.class_name && !classes.has(r.class_name.toLowerCase())) r.errors.push(`Không có lớp ${r.class_name}`);
    });
    setRows(parsed);
  }

  const valid = rows.filter((r) => r.errors.length === 0);

  return (
    <div className="space-y-4">
      <Card title="1. Chọn tệp">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
          <a className={btn("secondary")} download="mau_nhap_hoc_sinh.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}>Tải tệp mẫu</a>
        </div>
        <p className="mt-2 text-xs text-muted">Cột: {HEADERS.join(", ")}. Ngày sinh dạng YYYY-MM-DD hoặc DD/MM/YYYY. Mẫu cột cần nhà trường xác nhận theo biểu mẫu đang dùng.</p>
      </Card>
      {result?.error && <Alert tone="danger">{result.error}</Alert>}
      {rows.length > 0 && (
        <Card title={`2. Xem trước (${valid.length}/${rows.length} dòng hợp lệ)`}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Dòng</th><th>Mã</th><th>Họ tên</th><th>Ngày sinh</th><th>Lớp</th><th>Người giám hộ</th><th>Kiểm tra</th></tr></thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td><td>{r.code}</td><td>{r.full_name}</td><td>{r.date_of_birth ?? "—"}</td><td>{r.class_name || "—"}</td><td>{r.guardian_name || "—"}</td>
                    <td>{r.errors.length ? <Badge tone="danger">✕ {r.errors.join("; ")}</Badge> : <Badge tone="success">✓ Hợp lệ</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="mt-4 flex items-center gap-3">
            <button
              className={btn("primary")}
              disabled={pending || valid.length === 0}
              onClick={() => start(async () => {
                const r = await importStudents(valid);
                setResult({ message: r.message, error: r.error, failed: r.data });
                if (!r.error) setRows([]);
              })}
            >
              {pending ? "Đang nhập…" : `Nhập ${valid.length} học sinh hợp lệ`}
            </button>
            <span className="text-xs text-muted">Các dòng lỗi sẽ được bỏ qua.</span>
          </div>
        </Card>
      )}
      {result?.message && (
        <Alert tone={result.failed?.length ? "warning" : "success"}>
          {result.message}
          {result.failed?.length ? <ul className="mt-1 list-disc pl-4">{result.failed.slice(0, 20).map((f) => <li key={f}>{f}</li>)}</ul> : null}
        </Alert>
      )}
    </div>
  );
}

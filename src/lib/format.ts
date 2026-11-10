export const TZ = "Asia/Ho_Chi_Minh";

export function fmtDate(v?: string | Date | null) {
  if (!v) return "—";
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00+07:00") : new Date(v);
  return d.toLocaleDateString("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(v?: string | Date | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("vi-VN", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function fmtTime(v?: string | Date | null) {
  if (!v) return "";
  return new Date(v).toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
export function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa ngày iso */
export function mondayOf(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

/** Chuyển "YYYY-MM-DDTHH:mm" (giờ VN từ input datetime-local) sang ISO UTC */
export function vnLocalToISO(local: string) {
  return new Date(local + ":00+07:00").toISOString();
}

export function toVNLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export const WEEKDAYS = [
  { key: "mon", label: "Thứ Hai" },
  { key: "tue", label: "Thứ Ba" },
  { key: "wed", label: "Thứ Tư" },
  { key: "thu", label: "Thứ Năm" },
  { key: "fri", label: "Thứ Sáu" },
  { key: "sat", label: "Thứ Bảy" },
];

export function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]) {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** Phân tích CSV đơn giản (hỗ trợ dấu ngoặc kép) */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

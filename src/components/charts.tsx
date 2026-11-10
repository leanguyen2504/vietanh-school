import clsx from "clsx";

/** Biểu đồ cột đôi (ví dụ Thu / Chi theo tháng). Một trục, có chú thích, tooltip khi rê chuột. */
export function PairBarChart({ data, aLabel, bLabel, format, height = 220 }: {
  data: { key: string; label: string; a: number; b: number }[];
  aLabel: string; bLabel: string; format: (n: number) => string; height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  return (
    <div>
      <Legend items={[{ label: aLabel, cls: "bg-income" }, { label: bLabel, cls: "bg-expense" }]} />
      <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
        <div className="flex min-w-[520px] items-end gap-2 border-b border-line" style={{ height }} role="img" aria-label={`Biểu đồ ${aLabel} và ${bLabel}`}>
          {data.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t hover:bg-page">
              <div className="w-[38%] max-w-5 rounded-t bg-income" style={{ height: `${(d.a / max) * 100}%` }} />
              <div className="w-[38%] max-w-5 rounded-t bg-expense" style={{ height: `${(d.b / max) * 100}%` }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg group-hover:block">
                <p className="mb-1 font-semibold text-ink">{d.label}</p>
                <p className="flex items-center gap-2 text-ink"><span className="h-2 w-2 rounded-sm bg-income" />{aLabel}: {format(d.a)}</p>
                <p className="flex items-center gap-2 text-ink"><span className="h-2 w-2 rounded-sm bg-expense" />{bLabel}: {format(d.b)}</p>
                <p className="mt-1 border-t border-line pt-1 text-muted">Chênh lệch: {format(d.a - d.b)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex min-w-[520px] gap-2 pt-1">
          {data.map((d) => <span key={d.key} className="flex-1 text-center text-[11px] text-muted">{d.label}</span>)}
        </div>
      </div>
    </div>
  );
}

/** Thanh ngang một màu, có nhãn giá trị và tỷ lệ % */
export function HBarList({ items, tone = "income", format }: {
  items: { label: string; value: number; hint?: string }[]; tone?: "income" | "expense" | "brand"; format: (n: number) => string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(1, ...items.map((i) => i.value));
  const bar = tone === "income" ? "bg-income" : tone === "expense" ? "bg-expense" : "bg-brand";
  if (!items.length) return <p className="text-sm text-muted">Chưa có dữ liệu.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)} (${Math.round((i.value / total) * 100)}%)`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-ink">{i.label}</span>
            <span className="shrink-0 font-medium text-ink">{format(i.value)} <span className="font-normal text-muted">· {Math.round((i.value / total) * 100)}%</span></span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-page">
            <div className={clsx("h-2 rounded-full", bar)} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
          {i.hint && <p className="mt-0.5 text-xs text-muted">{i.hint}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Cột đơn (một chuỗi số liệu), nhãn giá trị trên mỗi cột */
export function ColumnChart({ data, format, height = 160, max: maxIn }: {
  data: { key: string; label: string; value: number | null; note?: string }[]; format: (n: number) => string; height?: number; max?: number;
}) {
  const max = maxIn ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div>
      <div className="flex items-end gap-2 border-b border-line" style={{ height }}>
        {data.map((d) => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.value == null ? "chưa có dữ liệu" : format(d.value)}${d.note ? ` · ${d.note}` : ""}`}>
            <span className="mb-1 text-[11px] font-medium text-ink">{d.value == null ? "—" : format(d.value)}</span>
            <div className="w-full max-w-8 rounded-t bg-brand" style={{ height: `${d.value == null ? 0 : Math.max(2, (d.value / max) * 85)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        {data.map((d) => <span key={d.key} className="flex-1 text-center text-[11px] text-muted">{d.label}</span>)}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; cls: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => <span key={i.label} className="flex items-center gap-1.5"><span className={clsx("h-2.5 w-2.5 rounded-sm", i.cls)} />{i.label}</span>)}
    </div>
  );
}

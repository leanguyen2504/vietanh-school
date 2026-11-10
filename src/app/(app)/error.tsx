"use client";

import { Alert, btn } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-10">
      <Alert tone="danger">Không tải được dữ liệu. {error.digest ? `Mã lỗi: ${error.digest}` : ""}</Alert>
      <button className={btn("primary")} onClick={() => reset()}>Thử lại</button>
    </div>
  );
}

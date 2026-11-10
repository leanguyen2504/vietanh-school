import clsx from "clsx";

/** Nhận diện dạng chữ. Thay bằng logo chính thức khi nhà trường cung cấp (đặt file vào public/logo.png). */
export function SchoolMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2">
      <div className={clsx("flex items-center justify-center rounded-lg bg-brand font-bold text-white", size === "lg" ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm")}>VA</div>
      <div className="leading-tight text-left">
        <p className={clsx("font-semibold text-ink", size === "lg" ? "text-base" : "text-sm")}>Trường TH & THCS Việt Anh</p>
        <p className="text-xs text-muted">Hải Phòng</p>
      </div>
    </div>
  );
}

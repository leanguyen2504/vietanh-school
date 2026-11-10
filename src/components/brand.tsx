import Image from "next/image";
import clsx from "clsx";

/** Logo chính thức của trường, lấy từ website th-thcsvietanh.haiphong.edu.vn. */
export const LOGO_URL =
  "https://admintruong.haiphong.shieldix.app/UploadImages/config/haiphong/2024/th-thcsvietanh/logo-new_31720241537.png";

export function SchoolLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={LOGO_URL}
      alt="Logo Trường Tiểu học & THCS Việt Anh"
      width={size}
      height={size}
      priority
      className={clsx("shrink-0 rounded-full", className)}
    />
  );
}

export function SchoolMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <SchoolLogo size={size === "lg" ? 52 : 40} />
      <div className="leading-tight text-left">
        <p className={clsx("font-semibold text-ink", size === "lg" ? "text-base" : "text-sm")}>Trường TH & THCS Việt Anh</p>
        <p className="text-xs text-muted">Hải Phòng</p>
      </div>
    </div>
  );
}

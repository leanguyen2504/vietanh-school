import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Logo chính thức lấy từ website trường (th-thcsvietanh.haiphong.edu.vn).
    remotePatterns: [{ protocol: "https", hostname: "admintruong.haiphong.shieldix.app", pathname: "/UploadImages/config/haiphong/**" }],
  },
};

export default nextConfig;

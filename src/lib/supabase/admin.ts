import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client dùng service role — CHỈ gọi ở server sau khi đã kiểm tra quyền quản trị. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

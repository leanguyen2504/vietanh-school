export const dynamic = "force-dynamic";

export default function SetupPage() {
  const ok = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Chưa cấu hình Supabase</h1>
      {ok ? (
        <p className="mt-2 text-sm">Đã có biến môi trường. Hãy tải lại trang chủ.</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>Ứng dụng cần các biến môi trường sau (xem file <code>.env.example</code> và README):</p>
          <ul className="list-disc pl-5">
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
            <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          </ul>
        </div>
      )}
    </main>
  );
}

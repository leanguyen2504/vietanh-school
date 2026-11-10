# Cổng quản trị nội bộ — Trường Tiểu học & THCS Việt Anh (MVP)

Hệ thống quản trị nội bộ: năm học, lớp, học sinh, nhân sự, điểm danh, thông báo, lịch công tác, công việc, tài liệu, thực đơn và báo cáo — phân quyền theo vai trò và phạm vi dữ liệu, kiểm tra ở cả server và database (Supabase RLS).

> Mọi dữ liệu mẫu đều **hư cấu** và được đánh dấu DEMO. Mã màu cam là màu **đề xuất**, cần đối chiếu nhận diện chính thức của trường.

## Công nghệ

- Next.js 15 (App Router, Server Actions) + TypeScript + Tailwind CSS 4
- Supabase: Auth, Postgres (RLS), Storage (bucket riêng tư `documents`)
- Zod để kiểm tra dữ liệu phía server
- Font Be Vietnam Pro, giao diện tiếng Việt, giờ theo `Asia/Ho_Chi_Minh`

## Cấu trúc

```
src/app/(auth)        Đăng nhập, quên mật khẩu
src/app/(app)         Các module sau đăng nhập (mỗi thư mục có page.tsx + actions.ts)
src/app/api           Xuất CSV, tải tệp qua URL ký tạm thời
src/lib               auth (ngữ cảnh + kiểm tra quyền), roles, định dạng, truy vấn dùng chung
supabase/migrations   Lược đồ, hàm phân quyền, RLS, trigger nhật ký
supabase/seed         Dữ liệu demo + script xóa demo
```

## Cài đặt

1. Tạo dự án Supabase, mở **SQL Editor** và chạy lần lượt các file trong `supabase/migrations/` (hoặc một file gộp `supabase/setup_all.sql` rồi `0004`, `0005`, `0006`). **`0005` phải chạy riêng, trước `0006`.**
2. (Tùy chọn) Dữ liệu demo: sửa mật khẩu ở dòng `demo_password` trong `supabase/seed/demo_seed.sql` rồi chạy. Tài khoản Chủ đầu tư, Kế toán và sổ thu/chi demo: `supabase/seed/demo_owner_finance.sql`. Xóa demo: `supabase/seed/reset_demo.sql`.
3. Sao chép `.env.example` thành `.env.local` và điền:

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Có | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Có | Publishable key (`sb_publishable_…`) hoặc anon key |
| `NEXT_PUBLIC_SITE_URL` | Nên có | URL website, dùng cho liên kết đặt lại mật khẩu / lời mời |
| `SUPABASE_SERVICE_ROLE_KEY` | Không | Chỉ để gửi lời mời tài khoản từ trang Cấu hình. Chỉ đặt ở server, không commit |

4. Trong Supabase → Authentication → URL Configuration: đặt **Site URL** và thêm `https://<domain>/auth/callback` vào Redirect URLs.
5. Chạy local:

```bash
npm install
npm run dev     # http://localhost:3000
```

## Tài khoản demo

Sau khi chạy seed: `quantri@`, `bgh@`, `hdt@`, `totruong.thcs@`, `gv.6a1@`, `gv.1a@`, `vanphong@`, `yte@`, `chudautu@` (Chủ đầu tư), `ketoan@` (Kế toán) + `demo.vietanh.example`, mật khẩu là giá trị `demo_password` bạn đặt. **Xóa toàn bộ tài khoản demo trước khi nhập dữ liệu thật.**

Tài khoản thật: quản trị viên mời qua Cấu hình → Tài khoản (cần service role key) hoặc tạo trong Supabase → Authentication, sau đó cấp vai trò + liên kết hồ sơ nhân sự + kích hoạt. Tài khoản mới mặc định **chưa có quyền**.

Tạo quản trị viên đầu tiên (SQL Editor):

```sql
update public.profiles set role = 'admin', is_active = true where email = 'email-cua-ban@truong.edu.vn';
```

## Phân quyền

| Vai trò | Phạm vi mặc định |
|---|---|
| Quản trị hệ thống | Toàn bộ nghiệp vụ, cấu hình, tài khoản, nhật ký; **không** xem tài chính |
| Chủ đầu tư | Mọi quyền của Ban Giám hiệu + xem toàn bộ (kể cả nhật ký, cấu hình); trang riêng *Tổng quan điều hành*; toàn quyền tài chính. Mỗi lần thêm/sửa/xóa dữ liệu, Ban Giám hiệu nhận thông báo trong hệ thống |
| Ban Giám hiệu | Toàn trường; duyệt/phát hành thông báo, thực đơn; quản lý lớp |
| Hội đồng trường | Báo cáo tổng hợp, tài liệu được chia sẻ; **không** xem hồ sơ cá nhân học sinh |
| Tổ trưởng | Lớp/học sinh thuộc cấp học của tổ; công việc của tổ; soạn thông báo (cần duyệt) |
| Giáo viên | Lớp được phân công (chủ nhiệm/bộ môn); điểm danh các lớp đó |
| Văn phòng | Hồ sơ học sinh, nhân sự, lịch, tài liệu, thực đơn (nhập), xuất dữ liệu |
| Kế toán | Ghi khoản thu/chi (chờ duyệt), sửa/xóa khoản của mình khi chưa duyệt, xem dashboard tài chính; lịch, thông báo, công việc, tài liệu |
| Y tế / bán trú | Xem học sinh; nhập thực đơn; không xem ghi chú hành chính |
| Phụ huynh | Đã thiết kế trong RLS (chỉ con đã xác minh) nhưng **chưa bật** |

### Tài chính

| Thao tác | Chủ đầu tư | Ban Giám hiệu | Kế toán | Vai trò khác |
|---|---|---|---|---|
| Xem dashboard, sổ thu/chi, xuất CSV | ✓ | ✓ | ✓ | ✗ |
| Ghi khoản thu/chi | ✓ (tự duyệt) | ✗ | ✓ (chờ duyệt) | ✗ |
| Duyệt / từ chối khoản chờ duyệt | ✓ | ✓ (không sửa nội dung) | ✗ | ✗ |
| Sửa / xóa khoản đã duyệt | ✓ | ✗ | ✗ | ✗ |
| Quản lý hạng mục | ✓ | ✗ | ✗ | ✗ |

Báo cáo chỉ tính khoản **đã duyệt**. Thông báo trong hệ thống (chuông): Kế toán ghi khoản → Chủ đầu tư + BGH; duyệt/từ chối → người ghi; Chủ đầu tư thay đổi → BGH. Chưa gửi email/Zalo.

Kiểm soát chính ở database: hàm trong schema `app` (`can_view_student`, `can_take_attendance`…), RLS trên mọi bảng, trigger chặn tự nâng quyền, chặn phát hành thông báo khi chưa được duyệt, khóa dữ liệu năm học đã khóa, và RPC `save_attendance` bắt buộc lý do khi sửa phiên đã xác nhận. Nhật ký `audit_logs` chỉ lưu tên cột thay đổi, không lưu giá trị cá nhân.

## Triển khai

Vercel: import repo, thêm các biến môi trường ở trên, deploy. Sau đó cập nhật Site URL/Redirect URLs trong Supabase.

## Chưa làm / dùng demo

- Email/SMS/Zalo: chưa tích hợp (chỉ thông báo trong hệ thống).
- Logo: đang dùng chữ "VA"; thay bằng logo chính thức khi trường cung cấp.
- Cổng phụ huynh, sổ điểm, học bạ, thời khóa biểu, thu phí…: để giai đoạn sau.
- Trạng thái "đã đọc" thông báo, đính kèm nhiều tệp.

## Câu hỏi cần nhà trường xác nhận

1. Phụ huynh có đăng nhập ở phiên bản đầu không? Cách xác minh liên kết phụ huynh–học sinh?
2. Đăng nhập bằng tài khoản quản trị cấp, email trường hay SSO?
3. Điểm danh theo ngày, buổi hay tiết? Ai được sửa sau khi xác nhận? (hiện tại: GV được phân công + BGH, bắt buộc lý do)
4. Quy tắc mã học sinh / mã nhân sự; mẫu danh sách đang dùng để nhập CSV.
5. Quy trình duyệt thông báo cụ thể (hiện tại: tổ trưởng/văn phòng soạn → BGH duyệt).
6. Một hay nhiều cơ sở cần phân quyền riêng?
7. THPT có cần bật ngay không?
8. Logo và mã màu chính thức; chính sách sao lưu và thời hạn lưu hồ sơ.

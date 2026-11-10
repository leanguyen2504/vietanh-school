-- Vai trò mới (chạy riêng trước 0006 vì giá trị enum mới phải được commit trước khi dùng)
alter type public.app_role add value if not exists 'owner' after 'admin';            -- Chủ đầu tư
alter type public.app_role add value if not exists 'accountant' after 'office';      -- Kế toán

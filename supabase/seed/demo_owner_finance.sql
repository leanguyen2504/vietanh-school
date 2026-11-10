-- =====================================================================
-- DỮ LIỆU DEMO: tài khoản Chủ đầu tư, Kế toán + sổ thu/chi 14 tháng (số liệu hư cấu)
-- Chạy SAU demo_seed.sql và migration 0005, 0006. Đổi mật khẩu trước khi chạy.
-- =====================================================================
do $$
declare
  demo_password text := 'VietAnh-Demo-2026';   -- ĐỔI TRƯỚC KHI CHẠY
  uid uuid;
  m date;
  lv record;
  f numeric;
  cat uuid;
  a jsonb;
  acct uuid;
begin
  insert into public.staff(code, full_name, work_email, work_phone, department_id, position, is_demo)
  select 'NV-DEMO-15', 'Trần Thu Demo', 'ketoan@demo.vietanh.example', '0900000015', d.id, 'Kế toán', true
  from public.departments d where d.code = 'VP'
  on conflict (code) do nothing;

  for a in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('email', 'chudautu@demo.vietanh.example', 'name', 'Chủ đầu tư Demo', 'role', 'owner', 'staff', null),
    jsonb_build_object('email', 'ketoan@demo.vietanh.example', 'name', 'Trần Thu Demo', 'role', 'accountant', 'staff', 'NV-DEMO-15')))
  loop
    if exists (select 1 from auth.users where email = a->>'email') then continue; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', a->>'email',
      extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', a->>'name'), now(), now(),
      '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', a->>'email', 'email_verified', true), 'email', now(), now(), now());
    update public.profiles set role = (a->>'role')::public.app_role, is_active = true, full_name = a->>'name',
      staff_id = (select id from public.staff where code = a->>'staff')
    where id = uid;
  end loop;

  if exists (select 1 from public.finance_entries where is_demo) then
    raise exception 'Đã có dữ liệu tài chính demo. Chạy reset_demo.sql trước nếu muốn tạo lại.';
  end if;
  perform setseed(0.42);

  for m in select generate_series(date_trunc('month', current_date) - interval '13 months', date_trunc('month', current_date), interval '1 month')::date loop
    -- Hè (tháng 6–8) thu học phí thấp hơn
    f := case when extract(month from m) in (6, 7, 8) then 0.35 else 1 end;
    for lv in select id, code from public.school_levels where is_active loop
      select id into cat from public.finance_categories where kind = 'income' and name = 'Học phí';
      insert into public.finance_entries(entry_date, kind, category_id, level_id, amount, description, is_demo)
      select m + 4, 'income', cat, lv.id,
        round((case lv.code when 'TH' then 420000000 else 380000000 end) * f * (0.95 + random()::numeric * 0.1), -5), '[DEMO] Thu học phí tháng', true
      where m + 4 <= current_date;
      select id into cat from public.finance_categories where kind = 'income' and name = 'Bán trú';
      insert into public.finance_entries(entry_date, kind, category_id, level_id, amount, description, is_demo)
      select m + 5, 'income', cat, lv.id,
        round((case lv.code when 'TH' then 95000000 else 70000000 end) * f * (0.9 + random()::numeric * 0.2), -5), '[DEMO] Thu tiền ăn bán trú', true
      where m + 5 <= current_date;
    end loop;
    insert into public.finance_entries(entry_date, kind, category_id, amount, description, is_demo)
    select m + 6, 'income', c.id, round(x.base * f * (0.85 + random()::numeric * 0.3), -5), x.note, true
    from (values ('Xe đưa đón', 48000000::numeric, '[DEMO] Thu phí xe đưa đón'),
                 ('Hoạt động ngoại khóa', 22000000::numeric, '[DEMO] Thu ngoại khóa, CLB'),
                 ('Thu khác', 6000000::numeric, '[DEMO] Thu khác')) x(cname, base, note)
    join public.finance_categories c on c.kind = 'income' and c.name = x.cname
    where m + 6 <= current_date;

    insert into public.finance_entries(entry_date, kind, category_id, amount, description, is_demo)
    select m + x.d, 'expense', c.id, round(x.base * (case when x.seasonal then f else 1 end) * (0.92 + random()::numeric * 0.16), -5), x.note, true
    from (values ('Lương & phụ cấp', 9, 510000000::numeric, false, '[DEMO] Chi lương tháng'),
                 ('Bảo hiểm', 10, 98000000::numeric, false, '[DEMO] Đóng BHXH, BHYT'),
                 ('Thực phẩm bán trú', 12, 140000000::numeric, true, '[DEMO] Thanh toán nhà cung cấp thực phẩm'),
                 ('Điện, nước, internet', 15, 38000000::numeric, false, '[DEMO] Tiền điện, nước, internet'),
                 ('Cơ sở vật chất', 18, 45000000::numeric, false, '[DEMO] Sửa chữa, bảo trì'),
                 ('Thiết bị & học liệu', 20, 25000000::numeric, true, '[DEMO] Mua học liệu'),
                 ('Tuyển sinh & truyền thông', 22, 18000000::numeric, false, '[DEMO] Truyền thông tuyển sinh'),
                 ('Chi khác', 25, 12000000::numeric, false, '[DEMO] Chi khác')) x(cname, d, base, seasonal, note)
    join public.finance_categories c on c.kind = 'expense' and c.name = x.cname
    where m + x.d <= current_date;
  end loop;
  -- Khoản đầu tư lớn dịp hè (sửa phòng học)
  insert into public.finance_entries(entry_date, kind, category_id, amount, description, is_demo)
  select (date_trunc('year', current_date) + interval '6 months 14 days')::date, 'expense', c.id, 650000000, '[DEMO] Cải tạo phòng học dịp hè', true
  from public.finance_categories c where c.kind = 'expense' and c.name = 'Cơ sở vật chất'
    and (date_trunc('year', current_date) + interval '6 months 14 days')::date <= current_date;
  update public.finance_entries set status = 'approved', reviewed_at = entry_date + 1 where is_demo;

  -- Vài khoản kế toán vừa ghi, đang chờ duyệt
  select id into acct from public.profiles where email = 'ketoan@demo.vietanh.example';
  insert into public.finance_entries(entry_date, kind, category_id, amount, description, status, created_by, is_demo)
  select current_date - x.d, x.k::public.finance_kind, c.id, x.amt, x.note, 'pending', acct, true
  from (values (1, 'expense', 'Thiết bị & học liệu', 36500000, '[DEMO] Mua máy chiếu phòng 6A2'),
               (0, 'expense', 'Cơ sở vật chất', 12800000, '[DEMO] Sửa điều hòa phòng giáo viên'),
               (0, 'income', 'Hoạt động ngoại khóa', 18400000, '[DEMO] Thu phí CLB Robotics')) x(d, k, cname, amt, note)
  join public.finance_categories c on c.kind = x.k::public.finance_kind and c.name = x.cname;
end $$;

-- =====================================================================
-- DỮ LIỆU DEMO HƯ CẤU — Việt Anh School Admin
-- Mọi tên người, mã, số điện thoại, email ở đây đều là bịa đặt, đánh dấu is_demo = true.
-- Email demo dùng tên miền dành riêng ".example" (không gửi được thư thật).
-- KHÔNG chạy file này trên dự án đã có dữ liệu thật.
-- Đổi mật khẩu demo ở dòng "demo_password" trước khi chạy.
-- Xóa toàn bộ dữ liệu demo: chạy reset_demo.sql
-- =====================================================================
do $$
declare
  demo_password text := 'VietAnh-Demo-2026';   -- ĐỔI TRƯỚC KHI CHẠY
  y_old uuid; y uuid;
  lv_th uuid; lv_thcs uuid;
  d_bgh uuid; d_hdt uuid; d_th uuid; d_thcs uuid; d_vp uuid; d_nt uuid;
  ho text[] := array['Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ','Đặng','Bùi','Đỗ','Ngô','Dương','Lý'];
  dem text[] := array['Minh','Gia','Bảo','Thanh','Khánh','Ngọc','Đức','Thu','Hải','Phương','Quang','Anh'];
  ten text[] := array['An','Bình','Châu','Dũng','Giang','Hà','Huy','Khoa','Lan','Linh','Mai','Nam','Nhi','Phúc','Quân','Sơn','Tâm','Trang','Vy','Yến'];
  rel text[] := array['Mẹ','Bố'];
  cr record; i int; n int := 0; sid uuid; gid uuid; sess uuid;

  st_ids uuid[] := '{}'; sx uuid;
  accounts jsonb := '[
    {"email":"quantri@demo.vietanh.example","name":"Quản trị Demo","role":"admin","staff":"NV-DEMO-01"},
    {"email":"bgh@demo.vietanh.example","name":"Phạm Thu Demo","role":"principal","staff":"NV-DEMO-02"},
    {"email":"hdt@demo.vietanh.example","name":"Lê Văn Demo","role":"board","staff":"NV-DEMO-03"},
    {"email":"totruong.thcs@demo.vietanh.example","name":"Đỗ Minh Demo","role":"head","staff":"NV-DEMO-04"},
    {"email":"gv.6a1@demo.vietanh.example","name":"Nguyễn Hà Demo","role":"teacher","staff":"NV-DEMO-05"},
    {"email":"gv.1a@demo.vietanh.example","name":"Trần Lan Demo","role":"teacher","staff":"NV-DEMO-06"},
    {"email":"vanphong@demo.vietanh.example","name":"Bùi Mai Demo","role":"office","staff":"NV-DEMO-07"},
    {"email":"yte@demo.vietanh.example","name":"Vũ Yến Demo","role":"health","staff":"NV-DEMO-08"}
  ]';
  a jsonb; uid uuid; mon date;
begin
  select id into lv_th from public.school_levels where code = 'TH';
  select id into lv_thcs from public.school_levels where code = 'THCS';
  select id into d_bgh from public.departments where code = 'BGH';
  select id into d_hdt from public.departments where code = 'HDT';
  select id into d_th from public.departments where code = 'TH';
  select id into d_thcs from public.departments where code = 'THCS';
  select id into d_vp from public.departments where code = 'VP';
  select id into d_nt from public.departments where code = 'NT';

  -- Năm học
  insert into public.academic_years(name, start_date, end_date, status) values ('2025-2026', '2025-09-05', '2026-05-31', 'locked') returning id into y_old;
  insert into public.academic_years(name, start_date, end_date, status) values ('2026-2027', '2026-09-05', '2027-05-31', 'active') returning id into y;

  -- Nhân sự demo
  insert into public.staff(code, full_name, work_email, work_phone, department_id, position, is_demo) values
    ('NV-DEMO-01', 'Quản trị Demo', 'quantri@demo.vietanh.example', '0900000001', d_vp, 'Quản trị hệ thống', true),
    ('NV-DEMO-02', 'Phạm Thu Demo', 'bgh@demo.vietanh.example', '0900000002', d_bgh, 'Hiệu trưởng', true),
    ('NV-DEMO-03', 'Lê Văn Demo', 'hdt@demo.vietanh.example', '0900000003', d_hdt, 'Thành viên Hội đồng trường', true),
    ('NV-DEMO-04', 'Đỗ Minh Demo', 'totruong.thcs@demo.vietanh.example', '0900000004', d_thcs, 'Tổ trưởng THCS', true),
    ('NV-DEMO-05', 'Nguyễn Hà Demo', 'gv.6a1@demo.vietanh.example', '0900000005', d_thcs, 'Giáo viên Ngữ văn', true),
    ('NV-DEMO-06', 'Trần Lan Demo', 'gv.1a@demo.vietanh.example', '0900000006', d_th, 'Giáo viên Tiểu học', true),
    ('NV-DEMO-07', 'Bùi Mai Demo', 'vanphong@demo.vietanh.example', '0900000007', d_vp, 'Văn thư', true),
    ('NV-DEMO-08', 'Vũ Yến Demo', 'yte@demo.vietanh.example', '0900000008', d_vp, 'Nhân viên y tế', true),
    ('NV-DEMO-09', 'Hoàng Quang Demo', null, null, d_th, 'Giáo viên Tiểu học', true),
    ('NV-DEMO-10', 'Ngô Phương Demo', null, null, d_th, 'Giáo viên Tiểu học', true),
    ('NV-DEMO-11', 'Dương Khánh Demo', null, null, d_thcs, 'Giáo viên Toán', true),
    ('NV-DEMO-12', 'Lý Ngọc Demo', null, null, d_thcs, 'Giáo viên Tiếng Anh', true),
    ('NV-DEMO-13', 'Đặng Hải Demo', null, null, d_nt, 'Giáo viên Âm nhạc', true),
    ('NV-DEMO-14', 'Vũ Thanh Demo', null, null, d_th, 'Giáo viên Tiểu học', true);

  -- Tài khoản demo (Supabase Auth)
  for a in select * from jsonb_array_elements(accounts) loop
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
    update public.profiles set role = (a->>'role')::public.app_role, is_active = true,
      staff_id = (select id from public.staff where code = a->>'staff'), full_name = a->>'name'
    where id = uid;
  end loop;

  -- Lớp năm cũ (để minh họa lịch sử) và năm hiện tại
  insert into public.classes(academic_year_id, grade_id, name, room, capacity, status)
  select y_old, g.id, x.name, null, 30, 'ended'
  from (values (1,'1A'),(2,'2A'),(3,'3A'),(4,'4A'),(5,'5A'),(6,'6A1'),(6,'6A2'),(7,'7A1'),(8,'8A1'),(9,'9A1')) x(gn, name)
  join public.grades g on g.grade_number = x.gn and g.level_id in (lv_th, lv_thcs);

  insert into public.classes(academic_year_id, grade_id, name, room, capacity, homeroom_staff_id)
  select y, g.id, x.name, x.room, 30, (select id from public.staff where code = x.gvcn)
  from (values (1,'1A','P101','NV-DEMO-06'),(2,'2A','P102','NV-DEMO-09'),(3,'3A','P103','NV-DEMO-10'),(4,'4A','P104','NV-DEMO-14'),
               (5,'5A','P105',null),(6,'6A1','P201','NV-DEMO-05'),(6,'6A2','P202','NV-DEMO-11'),(7,'7A1','P203','NV-DEMO-12'),
               (8,'8A1','P204',null),(9,'9A1','P205',null)) x(gn, name, room, gvcn)
  join public.grades g on g.grade_number = x.gn and g.level_id in (lv_th, lv_thcs);

  -- Phân công
  insert into public.teaching_assignments(academic_year_id, class_id, staff_id, is_homeroom, subject)
  select y, c.id, c.homeroom_staff_id, true, 'Chủ nhiệm' from public.classes c where c.academic_year_id = y and c.homeroom_staff_id is not null;
  insert into public.teaching_assignments(academic_year_id, class_id, staff_id, is_homeroom, subject)
  select y, c.id, (select id from public.staff where code = 'NV-DEMO-05'), false, 'Ngữ văn'
  from public.classes c where c.academic_year_id = y and c.name in ('7A1', '8A1');
  insert into public.teaching_assignments(academic_year_id, class_id, staff_id, is_homeroom, subject)
  select y, c.id, (select id from public.staff where code = 'NV-DEMO-13'), false, 'Âm nhạc'
  from public.classes c where c.academic_year_id = y;

  -- Học sinh + người giám hộ + ghi danh
  for cr in select cl.id, cl.name, g.grade_number from public.classes cl join public.grades g on g.id = cl.grade_id
           where cl.academic_year_id = y order by g.grade_number, cl.name loop
    for i in 1..8 loop
      n := n + 1;
      insert into public.students(code, full_name, date_of_birth, gender, admission_date, is_demo)
      values ('HS-DEMO-' || lpad(n::text, 4, '0'),
              ho[1 + (n * 7) % array_length(ho, 1)] || ' ' || dem[1 + (n * 5) % array_length(dem, 1)] || ' ' || ten[1 + (n * 3) % array_length(ten, 1)],
              make_date(2020 - cr.grade_number, 1 + n % 12, 1 + n % 27),
              case when n % 2 = 0 then 'female' else 'male' end,
              '2026-09-05', true)
      returning id into sid;
      insert into public.guardians(full_name, phone, email, is_demo)
      values ('Phụ huynh Demo ' || n, '09' || lpad((10000000 + n)::text, 8, '0'), null, true) returning id into gid;
      insert into public.student_guardians(student_id, guardian_id, relationship, is_primary)
      values (sid, gid, rel[1 + n % 2], true);
      insert into public.enrollments(student_id, class_id, academic_year_id, start_date)
      values (sid, cr.id, y, '2026-09-05');
    end loop;
  end loop;
  -- Một học sinh đã chuyển trường (minh họa trạng thái)
  update public.students set status = 'transferred_out', leave_date = '2026-10-15' where code = 'HS-DEMO-0080';
  update public.enrollments set status = 'ended', end_date = '2026-10-15'
   where student_id = (select id from public.students where code = 'HS-DEMO-0080');

  -- Điểm danh mẫu: 5 ngày gần nhất cho phần lớn lớp (để lại vài lớp chưa điểm danh hôm nay)
  for i in 1..5 loop
    for cr in select cl.id, cl.name from public.classes cl where cl.academic_year_id = y loop
      continue when i = 1 and cr.name in ('5A', '8A1', '9A1');
      insert into public.attendance_sessions(class_id, date, session, status, confirmed_at)
      values (cr.id, (now() at time zone 'Asia/Ho_Chi_Minh')::date - (i - 1), 'full_day', 'confirmed', now())
      returning id into sess;
      insert into public.attendance_records(session_id, student_id, status, reason)
      select sess, e.student_id,
             (case when random() < 0.9 then 'present' when random() < 0.5 then 'excused' when random() < 0.5 then 'late' else 'unexcused' end)::public.attendance_status,
             null
      from public.enrollments e where e.class_id = cr.id and e.status = 'active';
    end loop;
  end loop;

  -- Thông báo
  select id into uid from public.profiles where email = 'bgh@demo.vietanh.example';
  insert into public.announcements(title, body, audience_type, priority, status, created_by, approved_by, approved_at, published_by, published_at, expires_at) values
    ('[DEMO] Lịch họp hội đồng sư phạm tháng 11', 'Kính gửi toàn thể cán bộ, giáo viên. Cuộc họp hội đồng sư phạm tháng 11 diễn ra vào chiều thứ Sáu tuần này tại phòng hội đồng. Đây là nội dung demo.', 'staff', 'high', 'published', uid, uid, now(), uid, now(), now() + interval '30 days'),
    ('[DEMO] Kế hoạch tổ chức ngày Nhà giáo Việt Nam 20/11', 'Nội dung demo: phân công các khối chuẩn bị chương trình văn nghệ chào mừng 20/11.', 'all', 'normal', 'published', uid, uid, now(), uid, now(), null);
  select id into uid from public.profiles where email = 'totruong.thcs@demo.vietanh.example';
  insert into public.announcements(title, body, audience_type, audience_ids, priority, status, created_by) values
    ('[DEMO] Lịch kiểm tra giữa kỳ I khối THCS', 'Nội dung demo: lịch kiểm tra giữa kỳ các môn khối 6-9.', 'level', array[lv_thcs], 'normal', 'pending', uid);

  -- Lịch công tác tuần này
  mon := date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')::date;
  insert into public.events(title, description, start_at, end_at, location, owner_staff_id, participants) values
    ('[DEMO] Chào cờ đầu tuần', null, (mon + time '07:15') at time zone 'Asia/Ho_Chi_Minh', (mon + time '08:00') at time zone 'Asia/Ho_Chi_Minh', 'Sân trường', (select id from public.staff where code='NV-DEMO-02'), 'Toàn trường'),
    ('[DEMO] Họp tổ chuyên môn THCS', 'Thống nhất đề kiểm tra giữa kỳ', (mon + 2 + time '14:00') at time zone 'Asia/Ho_Chi_Minh', (mon + 2 + time '16:00') at time zone 'Asia/Ho_Chi_Minh', 'Phòng họp tầng 2', (select id from public.staff where code='NV-DEMO-04'), 'Tổ THCS'),
    ('[DEMO] Họp hội đồng sư phạm', null, (mon + 4 + time '15:00') at time zone 'Asia/Ho_Chi_Minh', (mon + 4 + time '17:00') at time zone 'Asia/Ho_Chi_Minh', 'Phòng hội đồng', (select id from public.staff where code='NV-DEMO-02'), 'Cán bộ, giáo viên');

  -- Công việc
  insert into public.tasks(title, description, assigner_id, assignee_id, department_id, due_date, status) values
    ('[DEMO] Cập nhật danh sách học sinh khối 6', 'Đối chiếu sĩ số với giáo viên chủ nhiệm', (select id from public.profiles where email='bgh@demo.vietanh.example'), (select id from public.profiles where email='vanphong@demo.vietanh.example'), d_vp, current_date + 3, 'in_progress'),
    ('[DEMO] Chuẩn bị đề kiểm tra Ngữ văn 6', null, (select id from public.profiles where email='totruong.thcs@demo.vietanh.example'), (select id from public.profiles where email='gv.6a1@demo.vietanh.example'), d_thcs, current_date + 7, 'new'),
    ('[DEMO] Nộp báo cáo y tế học đường tháng 10', null, (select id from public.profiles where email='bgh@demo.vietanh.example'), (select id from public.profiles where email='yte@demo.vietanh.example'), d_vp, current_date - 2, 'waiting');

  -- Thực đơn tuần
  insert into public.menus(week_start, items, status, published_at) values
    (mon, '{"mon":"Cơm, thịt kho trứng, canh bí, chuối","tue":"Bún gà, rau cải, sữa chua","wed":"Cơm, cá sốt cà chua, canh rau ngót, cam","thu":"Phở bò, rau thơm, thanh long","fri":"Cơm, gà rang gừng, canh chua, dưa hấu"}', 'published', now()),
    (mon + 7, '{"mon":"Cơm, đậu sốt thịt, canh cải","tue":"Miến gà","wed":"Cơm, tôm rim, canh bí","thu":"Bún riêu","fri":"Cơm, thịt bò xào, canh rau"}', 'draft', null);
end $$;

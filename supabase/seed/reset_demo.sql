-- =====================================================================
-- XÓA DỮ LIỆU DEMO — chỉ xóa bản ghi do demo_seed.sql tạo ra.
-- Chạy trong Supabase SQL Editor. Sau đó có thể chạy lại demo_seed.sql.
-- =====================================================================
begin;
delete from public.attendance_records where student_id in (select id from public.students where is_demo);
delete from public.attendance_sessions s where not exists (select 1 from public.attendance_records r where r.session_id = s.id);
delete from public.enrollments where student_id in (select id from public.students where is_demo);
delete from public.student_notes where student_id in (select id from public.students where is_demo);
delete from public.student_guardians where student_id in (select id from public.students where is_demo);
delete from public.guardians where is_demo;
delete from public.students where is_demo;
delete from public.announcements where title like '[DEMO]%';
delete from public.events where title like '[DEMO]%';
delete from public.tasks where title like '[DEMO]%';
delete from public.menus where items::text like '%Cơm, thịt kho trứng%' or items::text like '%Cơm, đậu sốt thịt%';
delete from public.teaching_assignments where staff_id in (select id from public.staff where is_demo);
update public.classes set homeroom_staff_id = null where homeroom_staff_id in (select id from public.staff where is_demo);
delete from public.classes c where c.academic_year_id in (select id from public.academic_years where name in ('2025-2026', '2026-2027'))
  and not exists (select 1 from public.enrollments e where e.class_id = c.id);
delete from public.academic_years y where name in ('2025-2026', '2026-2027') and not exists (select 1 from public.classes c where c.academic_year_id = y.id);
delete from auth.users where email like '%@demo.vietanh.example';
delete from public.staff where is_demo;
commit;

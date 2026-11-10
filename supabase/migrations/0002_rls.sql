-- =====================================================================
-- Việt Anh School Admin — Hàm phân quyền, trigger, RLS và Storage
-- Chạy sau 0001_schema.sql
-- =====================================================================

create schema if not exists app;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------
-- 1. Hàm trợ giúp phân quyền (security definer để tránh đệ quy RLS)
-- ---------------------------------------------------------------------
create or replace function app.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function app.is_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() = any(roles), false)
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() is not null and app.my_role() <> 'parent', false)
$$;

create or replace function app.my_staff_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.staff_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function app.my_department_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.department_id from public.staff s where s.id = app.my_staff_id()
$$;

-- Vai trò xem toàn bộ dữ liệu học sinh / lớp
create or replace function app.is_school_wide() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('admin', 'principal', 'office', 'health')
$$;

create or replace function app.is_leadership() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('admin', 'principal')
$$;

-- Giáo viên được phân công lớp này
create or replace function app.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teaching_assignments ta
    where ta.class_id = p_class and ta.staff_id = app.my_staff_id()
  ) or exists (
    select 1 from public.classes c where c.id = p_class and c.homeroom_staff_id = app.my_staff_id()
  )
$$;

-- Tổ trưởng phụ trách cấp học của lớp
create or replace function app.heads_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('head') and exists (
    select 1 from public.classes c
    join public.grades g on g.id = c.grade_id
    join public.departments d on d.level_id = g.level_id
    where c.id = p_class and d.id = app.my_department_id()
  )
$$;

create or replace function app.can_view_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_school_wide()
      or app.is_role('board')
      or (app.is_role('teacher', 'head') and app.teaches_class(p_class))
      or app.heads_class(p_class)
$$;

create or replace function app.is_verified_parent_of(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('parent')
     and coalesce((select (value)::text::boolean from public.app_settings where key = 'parent_portal_enabled'), false)
     and exists (
       select 1 from public.student_guardians sg
       join public.guardians g on g.id = sg.guardian_id
       where sg.student_id = p_student and g.profile_id = auth.uid() and sg.verified_at is not null
     )
$$;

-- Xem hồ sơ học sinh (Hội đồng trường KHÔNG xem hồ sơ cá nhân, chỉ báo cáo tổng hợp)
create or replace function app.can_view_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_school_wide()
      or exists (
        select 1 from public.enrollments e
        where e.student_id = p_student
          and e.status = 'active'
          and ((app.is_role('teacher', 'head') and app.teaches_class(e.class_id)) or app.heads_class(e.class_id))
      )
      or app.is_verified_parent_of(p_student)
$$;

create or replace function app.can_manage_students() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('admin', 'principal', 'office')
$$;

create or replace function app.can_take_attendance(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_leadership() or (app.is_role('teacher', 'head') and app.teaches_class(p_class))
$$;

create or replace function app.setting_bool(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value)::text::boolean from public.app_settings where key = p_key), false)
$$;

grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------------
-- 2. Trigger chung
-- ---------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger staff_touch before update on public.staff for each row execute function app.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger students_touch before update on public.students for each row execute function app.touch_updated_at();
create trigger announcements_touch before update on public.announcements for each row execute function app.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function app.touch_updated_at();
create trigger menus_touch before update on public.menus for each row execute function app.touch_updated_at();
create trigger attendance_sessions_touch before update on public.attendance_sessions for each row execute function app.touch_updated_at();

-- Nhật ký kiểm toán: chỉ lưu tên cột thay đổi, không lưu giá trị cá nhân
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed text[];
  rid text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key) into changed
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value and n.key not in ('updated_at');
    if changed is null then return new; end if;
  end if;
  rid := coalesce((to_jsonb(coalesce(new, old)) ->> 'id'), null);
  insert into public.audit_logs(actor_id, action, entity, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, rid,
          case when changed is not null then jsonb_build_object('columns', changed) else null end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['academic_years','school_levels','grades','departments','classes','staff','profiles',
    'teaching_assignments','students','student_guardians','enrollments','attendance_sessions','announcements',
    'tasks','documents','menus','app_settings']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function app.audit_row()', t, t);
  end loop;
end $$;

-- Ghi nhật ký thủ công (xuất dữ liệu, duyệt, sửa điểm danh...)
create or replace function public.log_event(p_action text, p_entity text, p_entity_id text default null, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_staff() then raise exception 'Không có quyền'; end if;
  insert into public.audit_logs(actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
end $$;
grant execute on function public.log_event(text, text, text, jsonb) to authenticated;

-- Tạo profile khi có tài khoản mới (mặc định chưa kích hoạt, chưa có vai trò)
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- Người dùng thường không tự đổi vai trò / kích hoạt / liên kết nhân sự
create or replace function app.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if; -- service role / SQL editor
  if not app.is_role('admin') then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.staff_id is distinct from old.staff_id or new.email is distinct from old.email then
      raise exception 'Chỉ quản trị viên được thay đổi vai trò hoặc trạng thái tài khoản';
    end if;
  elsif new.id = auth.uid() and (new.role is distinct from 'admin' or not new.is_active) then
    raise exception 'Quản trị viên không thể tự hạ quyền hoặc khóa tài khoản của chính mình';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function app.guard_profile();

-- Thông báo: kiểm soát quy trình duyệt / phát hành ở tầng database
create or replace function app.guard_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  can_publish boolean := app.is_leadership() or not app.setting_bool('announcement_requires_approval');
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.approved_by := null; new.approved_at := null;
    new.published_by := null; new.published_at := null;
  end if;
  if new.status in ('scheduled', 'published') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if not can_publish then
      raise exception 'Bạn không có quyền phát hành thông báo; hãy gửi duyệt';
    end if;
    new.approved_by := auth.uid(); new.approved_at := now();
    new.published_by := auth.uid();
    new.published_at := coalesce(new.publish_at, now());
    new.return_reason := null;
  end if;
  if tg_op = 'UPDATE' and new.status = 'archived' and old.status is distinct from 'archived'
     and not (can_publish or old.created_by = auth.uid()) then
    raise exception 'Không có quyền thu hồi thông báo';
  end if;
  return new;
end $$;
create trigger announcements_guard before insert or update on public.announcements for each row execute function app.guard_announcement();

-- Thực đơn: chỉ BGH/quản trị phát hành
create or replace function app.guard_menu() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not app.is_leadership() then raise exception 'Chỉ Ban Giám hiệu/quản trị viên được phát hành thực đơn'; end if;
    new.published_by := auth.uid(); new.published_at := now();
  end if;
  return new;
end $$;
create trigger menus_guard before insert or update on public.menus for each row execute function app.guard_menu();

-- Công việc: tự ghi lịch sử khi đổi trạng thái / người phụ trách
create or replace function app.task_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_updates(task_id, author_id, content, to_status)
    values (new.id, auth.uid(), 'Tạo công việc', new.status);
  elsif new.status is distinct from old.status then
    insert into public.task_updates(task_id, author_id, content, from_status, to_status)
    values (new.id, auth.uid(), 'Cập nhật trạng thái', old.status, new.status);
  elsif new.assignee_id is distinct from old.assignee_id then
    insert into public.task_updates(task_id, author_id, content)
    values (new.id, auth.uid(), 'Đổi người phụ trách');
  end if;
  return new;
end $$;
create trigger tasks_history after insert or update on public.tasks for each row execute function app.task_history();

-- Năm học: lớp/ghi danh của năm khóa/lưu trữ chỉ đọc
create or replace function app.guard_year_writable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare st public.year_status;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select status into st from public.academic_years where id = coalesce(new.academic_year_id, old.academic_year_id);
  if st in ('locked', 'archived') then
    raise exception 'Năm học đã khóa/lưu trữ, dữ liệu chỉ đọc';
  end if;
  return coalesce(new, old);
end $$;
create trigger classes_year_guard before insert or update or delete on public.classes for each row execute function app.guard_year_writable();
create trigger enrollments_year_guard before insert or delete on public.enrollments for each row execute function app.guard_year_writable();
create trigger ta_year_guard before insert or update or delete on public.teaching_assignments for each row execute function app.guard_year_writable();

-- ---------------------------------------------------------------------
-- 3. RPC nghiệp vụ (kiểm tra quyền bên trong, chạy trong 1 giao dịch)
-- ---------------------------------------------------------------------

-- Lưu điểm danh: tạo/ghi phiên, ghi các bản ghi, xác nhận. Sửa sau khi xác nhận cần lý do + ghi nhật ký.
create or replace function public.save_attendance(
  p_class uuid, p_date date, p_session public.attendance_session_type,
  p_records jsonb, p_confirm boolean, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.attendance_sessions;
  r jsonb;
begin
  if not app.can_take_attendance(p_class) then
    raise exception 'Bạn không được phân công điểm danh lớp này';
  end if;
  if p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Không điểm danh cho ngày trong tương lai';
  end if;

  select * into s from public.attendance_sessions where class_id = p_class and date = p_date and session = p_session for update;
  if not found then
    insert into public.attendance_sessions(class_id, date, session, created_by, updated_by)
    values (p_class, p_date, p_session, auth.uid(), auth.uid()) returning * into s;
  elsif s.status = 'confirmed' then
    if app.setting_bool('attendance_edit_requires_reason') and coalesce(trim(p_reason), '') = '' then
      raise exception 'Phiên điểm danh đã xác nhận: cần nhập lý do chỉnh sửa';
    end if;
    insert into public.audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(), 'edit_after_confirm', 'attendance_sessions', s.id::text, jsonb_build_object('reason', left(p_reason, 500)));
  end if;

  for r in select * from jsonb_array_elements(p_records) loop
    -- chỉ nhận học sinh đang ghi danh trong lớp
    if not exists (select 1 from public.enrollments e where e.class_id = p_class and e.status = 'active'
                   and e.student_id = (r ->> 'student_id')::uuid) then
      raise exception 'Học sinh không thuộc lớp';
    end if;
    insert into public.attendance_records(session_id, student_id, status, reason, updated_by)
    values (s.id, (r ->> 'student_id')::uuid, (r ->> 'status')::public.attendance_status, nullif(r ->> 'reason', ''), auth.uid())
    on conflict (session_id, student_id) do update
      set status = excluded.status, reason = excluded.reason, updated_by = auth.uid(), updated_at = now();
  end loop;

  update public.attendance_sessions
     set updated_by = auth.uid(),
         status = case when p_confirm then 'confirmed' else status end,
         confirmed_by = case when p_confirm and status = 'draft' then auth.uid() else confirmed_by end,
         confirmed_at = case when p_confirm and status = 'draft' then now() else confirmed_at end
   where id = s.id;
  return s.id;
end $$;
grant execute on function public.save_attendance(uuid, date, public.attendance_session_type, jsonb, boolean, text) to authenticated;

-- Chuyển lớp: kết thúc ghi danh cũ, tạo ghi danh mới (giữ lịch sử)
create or replace function public.transfer_student(p_student uuid, p_new_class uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  y uuid;
begin
  if not app.can_manage_students() then raise exception 'Không có quyền'; end if;
  select academic_year_id into y from public.classes where id = p_new_class and status = 'active';
  if y is null then raise exception 'Lớp không hợp lệ hoặc không hoạt động'; end if;
  update public.enrollments set status = 'moved', end_date = current_date
   where student_id = p_student and academic_year_id = y and status = 'active';
  insert into public.enrollments(student_id, class_id, academic_year_id, note, created_by)
  values (p_student, p_new_class, y, p_note, auth.uid());
end $$;
grant execute on function public.transfer_student(uuid, uuid, text) to authenticated;

-- Sao chép cấu trúc lớp từ năm trước sang năm mới (bản nháp, không sao chép học sinh)
create or replace function public.copy_classes_from_year(p_from uuid, p_to uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not app.is_leadership() then raise exception 'Không có quyền'; end if;
  insert into public.classes(academic_year_id, grade_id, name, room, capacity, status)
  select p_to, c.grade_id, c.name, c.room, c.capacity, 'active'
  from public.classes c where c.academic_year_id = p_from
  on conflict (academic_year_id, name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.copy_classes_from_year(uuid, uuid) to authenticated;

-- Kích hoạt năm học: năm đang hoạt động cũ chuyển sang khóa (chỉ đọc)
create or replace function public.activate_year(p_year uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_role('admin') then raise exception 'Chỉ quản trị viên'; end if;
  update public.academic_years set status = 'locked' where status = 'active' and id <> p_year;
  update public.academic_years set status = 'active' where id = p_year;
end $$;
grant execute on function public.activate_year(uuid) to authenticated;

-- Báo cáo sĩ số tổng hợp (không chứa dữ liệu cá nhân) — dùng được cho Hội đồng trường
create or replace function public.report_enrollment_summary(p_year uuid)
returns table (level_name text, grade_name text, class_id uuid, class_name text, student_count bigint)
language sql stable security definer set search_path = '' as $$
  select l.name, g.name, c.id, c.name, count(e.id)
  from public.classes c
  join public.grades g on g.id = c.grade_id
  join public.school_levels l on l.id = g.level_id
  left join public.enrollments e on e.class_id = c.id and e.status = 'active'
  where c.academic_year_id = p_year
    and (app.is_role('admin', 'principal', 'board', 'office') or app.can_view_class(c.id))
  group by l.name, l.sort_order, g.name, g.grade_number, c.id, c.name
  order by l.sort_order, g.grade_number, c.name
$$;
grant execute on function public.report_enrollment_summary(uuid) to authenticated;

-- Tình trạng điểm danh theo ngày (tổng hợp, không dữ liệu cá nhân)
create or replace function public.report_attendance_day(p_year uuid, p_date date)
returns table (class_id uuid, class_name text, grade_number int, session_status text,
               total bigint, present bigint, excused bigint, unexcused bigint, late bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, g.grade_number,
         coalesce(max(s.status::text), 'missing'),
         count(r.id), count(r.id) filter (where r.status = 'present'),
         count(r.id) filter (where r.status = 'excused'),
         count(r.id) filter (where r.status = 'unexcused'),
         count(r.id) filter (where r.status = 'late')
  from public.classes c
  join public.grades g on g.id = c.grade_id
  left join public.attendance_sessions s on s.class_id = c.id and s.date = p_date
  left join public.attendance_records r on r.session_id = s.id
  where c.academic_year_id = p_year and c.status = 'active'
    and (app.is_role('admin', 'principal', 'board', 'office') or app.can_view_class(c.id))
  group by c.id, c.name, g.grade_number
  order by g.grade_number, c.name
$$;
grant execute on function public.report_attendance_day(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['school_levels','academic_years','departments','grades','staff','profiles','classes',
    'teaching_assignments','students','student_notes','guardians','student_guardians','enrollments',
    'attendance_sessions','attendance_records','announcements','events','tasks','task_updates','documents',
    'menus','audit_logs','app_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Danh mục: mọi nhân sự đọc; quản trị viên ghi
create policy levels_read on public.school_levels for select to authenticated using (app.is_staff());
create policy levels_write on public.school_levels for all to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));
create policy years_read on public.academic_years for select to authenticated using (app.is_staff());
create policy years_write on public.academic_years for all to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));
create policy depts_read on public.departments for select to authenticated using (app.is_staff());
create policy depts_write on public.departments for all to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));
create policy grades_read on public.grades for select to authenticated using (app.is_staff());
create policy grades_write on public.grades for all to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));
create policy settings_read on public.app_settings for select to authenticated using (app.is_staff());
create policy settings_write on public.app_settings for update to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));

-- Tài khoản
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on public.profiles for select to authenticated using (app.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated using (app.is_role('admin')) with check (app.is_role('admin'));

-- Nhân sự
create policy staff_read on public.staff for select to authenticated using (app.is_staff());
create policy staff_write on public.staff for insert to authenticated with check (app.is_role('admin', 'principal', 'office'));
create policy staff_update on public.staff for update to authenticated using (app.is_role('admin', 'principal', 'office')) with check (app.is_role('admin', 'principal', 'office'));

-- Lớp & phân công
create policy classes_read on public.classes for select to authenticated
  using (app.can_view_class(id) or exists (select 1 from public.enrollments e where e.class_id = classes.id and e.status = 'active' and app.is_verified_parent_of(e.student_id)));
create policy classes_write on public.classes for all to authenticated using (app.is_leadership()) with check (app.is_leadership());
create policy ta_read on public.teaching_assignments for select to authenticated using (app.is_staff());
create policy ta_write on public.teaching_assignments for all to authenticated using (app.is_leadership()) with check (app.is_leadership());

-- Học sinh
create policy students_read on public.students for select to authenticated using (app.can_view_student(id));
create policy students_insert on public.students for insert to authenticated with check (app.can_manage_students());
create policy students_update on public.students for update to authenticated using (app.can_manage_students()) with check (app.can_manage_students());
-- Không có policy DELETE: ưu tiên lưu trữ thay vì xóa cứng

create policy notes_read on public.student_notes for select to authenticated using (app.can_manage_students());
create policy notes_insert on public.student_notes for insert to authenticated with check (app.can_manage_students() and created_by = auth.uid());

create policy guardians_read on public.guardians for select to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.student_guardians sg where sg.guardian_id = guardians.id and app.can_view_student(sg.student_id) and app.is_staff()));
create policy guardians_write on public.guardians for insert to authenticated with check (app.can_manage_students());
create policy guardians_update on public.guardians for update to authenticated using (app.can_manage_students()) with check (app.can_manage_students());
create policy sg_read on public.student_guardians for select to authenticated using (app.can_view_student(student_id));
create policy sg_write on public.student_guardians for all to authenticated using (app.can_manage_students()) with check (app.can_manage_students());

create policy enroll_read on public.enrollments for select to authenticated using (app.can_view_student(student_id) or app.can_view_class(class_id));
create policy enroll_insert on public.enrollments for insert to authenticated with check (app.can_manage_students());
create policy enroll_update on public.enrollments for update to authenticated using (app.can_manage_students()) with check (app.can_manage_students());

-- Điểm danh: ghi qua RPC save_attendance; đọc theo phạm vi lớp
create policy att_s_read on public.attendance_sessions for select to authenticated
  using (app.can_view_class(class_id) or exists (select 1 from public.enrollments e where e.class_id = attendance_sessions.class_id and e.status = 'active' and app.is_verified_parent_of(e.student_id)));
create policy att_r_read on public.attendance_records for select to authenticated
  using (app.is_verified_parent_of(student_id) or exists (
    select 1 from public.attendance_sessions s where s.id = session_id
      and (app.can_take_attendance(s.class_id) or app.is_role('principal', 'admin', 'office', 'health') or app.heads_class(s.class_id))));

-- Thông báo
create or replace function app.announcement_visible(a public.announcements) returns boolean
language sql stable security definer set search_path = '' as $$
  select a.status = 'published'
     and (a.publish_at is null or a.publish_at <= now())
     and (a.expires_at is null or a.expires_at > now())
     and case a.audience_type
       when 'all' then app.my_role() is not null
       when 'staff' then app.is_staff()
       when 'role' then app.my_role() = any(a.audience_roles)
       when 'department' then app.my_department_id() = any(a.audience_ids)
       when 'level' then app.is_school_wide() or app.is_role('board') or exists (
            select 1 from public.classes c join public.grades g on g.id = c.grade_id
            where g.level_id = any(a.audience_ids) and app.can_view_class(c.id))
       when 'class' then app.is_school_wide() or exists (
            select 1 from unnest(a.audience_ids) cid where app.can_view_class(cid))
       else false end
$$;
grant execute on function app.announcement_visible(public.announcements) to authenticated;

create policy ann_read on public.announcements for select to authenticated
  using (created_by = auth.uid() or app.is_leadership() or app.announcement_visible(announcements));
create policy ann_insert on public.announcements for insert to authenticated
  with check (app.is_role('admin', 'principal', 'head', 'office'));
create policy ann_update on public.announcements for update to authenticated
  using (app.is_leadership() or (created_by = auth.uid() and status in ('draft', 'pending', 'scheduled', 'published')))
  with check (app.is_leadership() or created_by = auth.uid());

-- Lịch công tác
create policy events_read on public.events for select to authenticated using (app.is_staff());
create policy events_write on public.events for insert to authenticated with check (app.is_role('admin', 'principal', 'office', 'head'));
create policy events_update on public.events for update to authenticated
  using (app.is_leadership() or created_by = auth.uid()) with check (app.is_role('admin', 'principal', 'office', 'head'));
create policy events_delete on public.events for delete to authenticated using (app.is_leadership() or created_by = auth.uid());

-- Công việc
create policy tasks_read on public.tasks for select to authenticated
  using (app.is_leadership() or assigner_id = auth.uid() or assignee_id = auth.uid()
         or (app.is_role('head') and department_id = app.my_department_id()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (app.is_staff() and app.my_role() <> 'board' and assigner_id = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (app.is_leadership() or assigner_id = auth.uid() or assignee_id = auth.uid()
         or (app.is_role('head') and department_id = app.my_department_id()))
  with check (app.is_staff());
create policy tu_read on public.task_updates for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy tu_insert on public.task_updates for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id));

-- Tài liệu
create or replace function app.can_view_document(p_access public.doc_access, p_dept uuid, p_uploader uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff() and (
    p_uploader = auth.uid()
    or app.is_role('admin', 'principal')
    or case p_access
         when 'all_staff' then true
         when 'leadership' then app.is_role('board')
         when 'department' then p_dept = app.my_department_id()
       end)
$$;
grant execute on function app.can_view_document(public.doc_access, uuid, uuid) to authenticated;

create policy docs_read on public.documents for select to authenticated using (app.can_view_document(access_level, department_id, uploaded_by));
create policy docs_insert on public.documents for insert to authenticated
  with check (app.is_role('admin', 'principal', 'office', 'head') and uploaded_by = auth.uid()
              and (not app.is_role('head') or department_id = app.my_department_id()));
create policy docs_delete on public.documents for delete to authenticated using (app.is_leadership() or uploaded_by = auth.uid());

-- Thực đơn
create policy menus_read on public.menus for select to authenticated
  using (status = 'published' or app.is_role('admin', 'principal', 'office', 'health'));
create policy menus_insert on public.menus for insert to authenticated with check (app.is_role('admin', 'principal', 'office', 'health'));
create policy menus_update on public.menus for update to authenticated
  using (app.is_role('admin', 'principal', 'office', 'health')) with check (app.is_role('admin', 'principal', 'office', 'health'));

-- Nhật ký: chỉ quản trị viên xem; ghi qua trigger/RPC
create policy audit_read on public.audit_logs for select to authenticated using (app.is_role('admin'));

-- ---------------------------------------------------------------------
-- 5. Storage: bucket riêng tư cho tài liệu & tệp đính kèm
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

create policy "docs_storage_read" on storage.objects for select to authenticated
using (
  bucket_id = 'documents' and (
    exists (select 1 from public.documents d where d.storage_path = storage.objects.name
            and app.can_view_document(d.access_level, d.department_id, d.uploaded_by))
    or (name like 'announcements/%' and app.is_staff())
  )
);
create policy "docs_storage_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents' and app.is_role('admin', 'principal', 'office', 'head')
  and (name like 'library/%' or name like 'announcements/%')
);
create policy "docs_storage_delete" on storage.objects for delete to authenticated
using (bucket_id = 'documents' and (app.is_leadership() or owner_id = auth.uid()::text));

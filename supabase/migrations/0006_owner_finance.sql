-- =====================================================================
-- Chủ đầu tư (quyền như BGH + xem mọi thứ), thông báo cho BGH, sổ thu/chi có quy trình kế toán → duyệt
-- =====================================================================

create or replace function app.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('owner')
$$;

-- Chủ đầu tư có quyền tương đương Ban Giám hiệu ở mọi chỗ kiểm tra quyền
-- (xem + sửa dữ liệu nghiệp vụ). Quản lý tài khoản/cấu hình hệ thống vẫn chỉ dành cho quản trị viên.
create or replace function app.is_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    app.my_role() = any(roles)
    or (app.my_role() = 'owner' and 'principal'::public.app_role = any(roles)),
  false)
$$;

-- Chủ đầu tư đọc được cả các bảng chỉ quản trị viên xem (nhật ký, cấu hình)
do $$
declare t text;
begin
  foreach t in array array['school_levels','academic_years','departments','grades','staff','profiles','classes',
    'teaching_assignments','students','student_notes','guardians','student_guardians','enrollments',
    'attendance_sessions','attendance_records','announcements','events','tasks','task_updates','documents',
    'menus','audit_logs','app_settings']
  loop
    execute format('create policy owner_read on public.%I for select to authenticated using (app.is_owner())', t);
  end loop;
end $$;

create policy documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.is_owner());

-- ---------- Thông báo trong hệ thống ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text,
  link text,
  entity text,
  entity_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Người nhận chỉ được đổi trạng thái đã đọc
create or replace function app.guard_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'Chỉ được đánh dấu đã đọc';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function app.guard_notification();

-- Khi Chủ đầu tư thêm/sửa/xóa dữ liệu nghiệp vụ → báo cho tất cả tài khoản Ban Giám hiệu đang hoạt động
create or replace function app.notify_owner_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  rid text := r ->> 'id';
  entity_label text;
  item text;
  verb text;
  lnk text;
  actor text;
begin
  if app.my_role() is distinct from 'owner' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then return new; end if;

  verb := case tg_op when 'INSERT' then 'thêm' when 'UPDATE' then 'sửa' else 'xóa' end;
  entity_label := case tg_table_name
    when 'students' then 'học sinh' when 'staff' then 'nhân sự' when 'classes' then 'lớp học'
    when 'enrollments' then 'xếp lớp học sinh' when 'teaching_assignments' then 'phân công giảng dạy'
    when 'attendance_sessions' then 'phiên điểm danh' when 'announcements' then 'thông báo'
    when 'events' then 'lịch công tác' when 'tasks' then 'công việc' when 'documents' then 'tài liệu'
    when 'menus' then 'thực đơn' when 'academic_years' then 'năm học'
    when 'finance_entries' then 'khoản thu/chi' else tg_table_name end;
  item := coalesce(r ->> 'full_name', r ->> 'title', r ->> 'name', r ->> 'description', '');
  lnk := case tg_table_name
    when 'students' then '/students/' || rid when 'staff' then '/staff/' || rid
    when 'classes' then '/classes/' || rid when 'announcements' then '/announcements/' || rid
    when 'tasks' then '/tasks/' || rid when 'events' then '/events' when 'documents' then '/documents'
    when 'menus' then '/menus' when 'attendance_sessions' then '/attendance' when 'finance_entries' then '/finance'
    when 'enrollments' then '/students/' || (r ->> 'student_id')
    when 'teaching_assignments' then '/classes/' || (r ->> 'class_id') else null end;
  if tg_op = 'DELETE' and tg_table_name in ('students','staff','classes','announcements','tasks') then lnk := null; end if;
  select full_name into actor from public.profiles where id = auth.uid();

  insert into public.notifications(recipient_id, actor_id, title, body, link, entity, entity_id)
  select p.id, auth.uid(),
         'Chủ đầu tư đã ' || verb || ' ' || entity_label,
         coalesce(actor, 'Chủ đầu tư') || ' đã ' || verb || ' ' || entity_label
           || case when item <> '' then ': ' || item else '' end || '.',
         lnk, tg_table_name, rid
  from public.profiles p
  where p.role = 'principal' and p.is_active;
  return coalesce(new, old);
end $$;


-- ---------- Tài chính ----------
-- Quy trình: Kế toán ghi sổ (chờ duyệt) → Ban Giám hiệu hoặc Chủ đầu tư duyệt / từ chối.
-- Báo cáo tài chính chỉ tính các khoản đã duyệt. Quản trị hệ thống và các vai trò khác không xem được.
create type public.finance_kind as enum ('income', 'expense');
create type public.finance_status as enum ('pending', 'approved', 'rejected');

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  kind public.finance_kind not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (kind, name)
);

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  kind public.finance_kind not null,
  category_id uuid not null references public.finance_categories(id),
  level_id uuid references public.school_levels(id),
  amount bigint not null check (amount > 0 and amount < 100000000000),  -- VNĐ
  description text check (char_length(description) <= 500),
  status public.finance_status not null default 'pending',
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finance_entries_date_idx on public.finance_entries(entry_date);
create index finance_entries_status_idx on public.finance_entries(status);

create or replace function app.can_view_finance() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_role('principal', 'accountant')   -- is_role coi Chủ đầu tư như BGH
$$;

-- Kiểm soát chi tiết ai được đổi gì
create or replace function app.guard_finance_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'DELETE' and not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.kind = new.kind) then
    raise exception 'Hạng mục không khớp loại thu/chi';
  end if;
  if auth.uid() is null then return coalesce(new, old); end if;  -- SQL editor / seed

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if app.is_owner() then
      -- Chủ đầu tư ghi trực tiếp: tự duyệt
      new.status := 'approved'; new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
    end if;
    return new;
  end if;

  if app.is_owner() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if app.is_role('accountant') and old.created_by = auth.uid() and old.status <> 'approved' then return old; end if;
    raise exception 'Chỉ xóa được khoản do mình ghi và chưa được duyệt';
  end if;

  -- UPDATE
  if app.is_role('accountant') and not app.is_role('principal') then
    if old.created_by is distinct from auth.uid() or old.status = 'approved' then
      raise exception 'Khoản đã duyệt hoặc do người khác ghi thì kế toán không sửa được';
    end if;
    -- Sửa xong thì gửi duyệt lại
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null;
    new.created_by := old.created_by; new.is_demo := old.is_demo;
    return new;
  end if;

  if app.is_role('principal') then
    -- BGH chỉ duyệt / từ chối, không sửa nội dung
    if (to_jsonb(new) - array['status','review_note','reviewed_by','reviewed_at','updated_at'])
       is distinct from (to_jsonb(old) - array['status','review_note','reviewed_by','reviewed_at','updated_at']) then
      raise exception 'Ban Giám hiệu chỉ duyệt hoặc từ chối, không sửa nội dung khoản thu/chi';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    return new;
  end if;
  raise exception 'Không có quyền';
end $$;
create trigger finance_entries_guard before insert or update or delete on public.finance_entries
  for each row execute function app.guard_finance_entry();
create trigger finance_entries_touch before update on public.finance_entries
  for each row execute function app.touch_updated_at();
create trigger finance_entries_audit after insert or update or delete on public.finance_entries
  for each row execute function app.audit_row();
create trigger finance_categories_audit after insert or update or delete on public.finance_categories
  for each row execute function app.audit_row();

alter table public.finance_categories enable row level security;
alter table public.finance_entries enable row level security;
create policy finance_categories_read on public.finance_categories for select to authenticated using (app.can_view_finance());
create policy finance_categories_write on public.finance_categories for all to authenticated
  using (app.is_owner()) with check (app.is_owner());
create policy finance_entries_read on public.finance_entries for select to authenticated using (app.can_view_finance());
create policy finance_entries_insert on public.finance_entries for insert to authenticated
  with check (app.is_owner() or app.is_role('accountant'));
create policy finance_entries_update on public.finance_entries for update to authenticated
  using (app.can_view_finance()) with check (app.can_view_finance());
create policy finance_entries_delete on public.finance_entries for delete to authenticated
  using (app.is_owner() or (app.is_role('accountant') and created_by = auth.uid()));

-- Thông báo quy trình tài chính
create or replace function app.notify_finance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := case new.kind when 'income' then 'khoản thu' else 'khoản chi' end;
  money text := replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.') || ' đ';
  actor text;
begin
  if auth.uid() is null then return new; end if;
  select full_name into actor from public.profiles where id = auth.uid();
  -- Kế toán ghi / sửa → báo Chủ đầu tư và BGH có khoản chờ duyệt
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending' or to_jsonb(new) - 'updated_at' <> to_jsonb(old) - 'updated_at') then
    insert into public.notifications(recipient_id, actor_id, title, body, link, entity, entity_id)
    select p.id, auth.uid(), 'Có ' || label || ' chờ duyệt',
           coalesce(actor, 'Kế toán') || ' đã ghi ' || label || ' ' || money || coalesce(': ' || new.description, '') || '.',
           '/finance?status=pending', 'finance_entries', new.id::text
    from public.profiles p where p.role in ('principal', 'owner') and p.is_active and p.id <> auth.uid();
  end if;
  -- Được duyệt / từ chối → báo người ghi
  if tg_op = 'UPDATE' and new.status in ('approved', 'rejected') and old.status is distinct from new.status
     and new.created_by is not null and new.created_by <> auth.uid() then
    insert into public.notifications(recipient_id, actor_id, title, body, link, entity, entity_id)
    values (new.created_by, auth.uid(),
      case new.status when 'approved' then 'Khoản thu/chi đã được duyệt' else 'Khoản thu/chi bị từ chối' end,
      coalesce(actor, '') || case new.status when 'approved' then ' đã duyệt ' else ' đã từ chối ' end || label || ' ' || money
        || coalesce(' — ' || new.review_note, '') || '.',
      '/finance', 'finance_entries', new.id::text);
  end if;
  return new;
end $$;
create trigger finance_entries_notify after insert or update on public.finance_entries
  for each row execute function app.notify_finance();

insert into public.finance_categories(kind, name, sort_order) values
  ('income', 'Học phí', 1), ('income', 'Bán trú', 2), ('income', 'Xe đưa đón', 3),
  ('income', 'Hoạt động ngoại khóa', 4), ('income', 'Thu khác', 9),
  ('expense', 'Lương & phụ cấp', 1), ('expense', 'Bảo hiểm', 2), ('expense', 'Thực phẩm bán trú', 3),
  ('expense', 'Điện, nước, internet', 4), ('expense', 'Cơ sở vật chất', 5), ('expense', 'Thiết bị & học liệu', 6),
  ('expense', 'Tuyển sinh & truyền thông', 7), ('expense', 'Chi khác', 9);

-- Chủ đầu tư thay đổi dữ liệu nghiệp vụ → báo Ban Giám hiệu
do $$
declare t text;
begin
  foreach t in array array['students','staff','classes','enrollments','teaching_assignments','attendance_sessions',
    'announcements','events','tasks','documents','menus','academic_years','finance_entries']
  loop
    execute format('create trigger %I_owner_notify after insert or update or delete on public.%I for each row execute function app.notify_owner_change()', t, t);
  end loop;
end $$;

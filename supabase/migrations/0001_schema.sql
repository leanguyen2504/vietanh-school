-- =====================================================================
-- Việt Anh School Admin — Lược đồ dữ liệu (MVP)
-- Chạy file này trước, sau đó chạy 0002_rls.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Kiểu liệt kê ----------
create type public.app_role as enum (
  'admin',       -- Quản trị hệ thống
  'board',       -- Hội đồng trường
  'principal',   -- Ban Giám hiệu
  'head',        -- Tổ trưởng / trưởng bộ phận
  'teacher',     -- Giáo viên
  'office',      -- Nhân viên văn phòng
  'health',      -- Nhân viên y tế / bán trú
  'parent'       -- Phụ huynh (chưa bật ở MVP)
);

create type public.year_status as enum ('draft', 'active', 'locked', 'archived');
create type public.class_status as enum ('active', 'ended', 'archived');
create type public.student_status as enum ('studying', 'transferred_out', 'dropped', 'graduated');
create type public.staff_status as enum ('working', 'on_leave', 'resigned');
create type public.enrollment_status as enum ('active', 'moved', 'ended');
create type public.attendance_session_type as enum ('full_day', 'morning', 'afternoon');
create type public.attendance_session_status as enum ('draft', 'confirmed');
create type public.attendance_status as enum ('present', 'excused', 'unexcused', 'late');
create type public.announcement_status as enum ('draft', 'pending', 'scheduled', 'published', 'archived');
create type public.announcement_audience as enum ('all', 'staff', 'level', 'class', 'department', 'role');
create type public.priority_level as enum ('normal', 'high', 'urgent');
create type public.task_status as enum ('new', 'in_progress', 'waiting', 'done');
create type public.doc_access as enum ('all_staff', 'department', 'leadership');
create type public.menu_status as enum ('draft', 'published');

-- ---------- Danh mục / cấu hình ----------
create table public.school_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- TH, THCS, THPT
  name text not null,
  is_active boolean not null default true, -- THPT = false cho đến khi trường xác nhận
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- "2025-2026"
  start_date date not null,
  end_date date not null,
  status public.year_status not null default 'draft',
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
-- Chỉ một năm học ở trạng thái active
create unique index academic_years_one_active on public.academic_years (status) where status = 'active';

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  level_id uuid references public.school_levels(id), -- tổ chuyên môn gắn với cấp học (nếu có)
  created_at timestamptz not null default now()
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.school_levels(id),
  grade_number int not null,
  name text not null,                      -- "Khối 6"
  unique (level_id, grade_number)
);

-- ---------- Nhân sự & tài khoản ----------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  work_email text,
  work_phone text,
  department_id uuid references public.departments(id),
  position text,
  status public.staff_status not null default 'working',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_department_idx on public.staff(department_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role,                     -- null = chưa được cấp quyền
  staff_id uuid unique references public.staff(id) on delete set null,
  is_active boolean not null default false, -- quản trị viên phải kích hoạt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  grade_id uuid not null references public.grades(id),
  name text not null,                      -- "6A1"
  room text,
  capacity int check (capacity is null or capacity > 0),
  homeroom_staff_id uuid references public.staff(id),
  status public.class_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (academic_year_id, name)
);
create index classes_year_idx on public.classes(academic_year_id);

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid not null references public.classes(id) on delete cascade,
  staff_id uuid not null references public.staff(id),
  is_homeroom boolean not null default false,
  subject text,
  created_at timestamptz not null default now(),
  unique (class_id, staff_id, subject)
);
create index ta_staff_idx on public.teaching_assignments(staff_id);

-- ---------- Học sinh ----------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  status public.student_status not null default 'studying',
  admission_date date,
  leave_date date,
  photo_path text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_name_idx on public.students using gin (to_tsvector('simple', full_name));

-- Ghi chú hành chính: bảng riêng để phân quyền chặt
create table public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  profile_id uuid unique references public.profiles(id) on delete set null, -- tài khoản phụ huynh (khi bật)
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text not null,              -- Bố, Mẹ, Ông, Bà...
  is_primary boolean not null default false,
  verified_at timestamptz,                 -- trường xác minh liên kết
  verified_by uuid references public.profiles(id) on delete set null,
  primary key (student_id, guardian_id)
);

-- Ghi danh theo năm học/lớp — lưu lịch sử, không ghi đè
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  class_id uuid not null references public.classes(id),
  academic_year_id uuid not null references public.academic_years(id),
  start_date date not null default current_date,
  end_date date,
  status public.enrollment_status not null default 'active',
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index enrollments_one_active on public.enrollments (student_id, academic_year_id) where status = 'active';
create index enrollments_class_idx on public.enrollments(class_id) where status = 'active';

-- ---------- Điểm danh ----------
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  date date not null,
  session public.attendance_session_type not null default 'full_day',
  status public.attendance_session_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  unique (class_id, date, session)
);
create index attendance_sessions_date_idx on public.attendance_sessions(date);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id),
  status public.attendance_status not null default 'present',
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- ---------- Thông báo & lịch ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience_type public.announcement_audience not null default 'staff',
  audience_ids uuid[] not null default '{}',          -- level/class/department ids
  audience_roles public.app_role[] not null default '{}',
  priority public.priority_level not null default 'normal',
  status public.announcement_status not null default 'draft',
  publish_at timestamptz,
  expires_at timestamptz,
  attachment_path text,
  return_reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create index announcements_status_idx on public.announcements(status, publish_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  owner_staff_id uuid references public.staff(id),
  participants text,
  document_id uuid,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);
create index events_start_idx on public.events(start_at);

-- ---------- Công việc ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigner_id uuid references public.profiles(id) on delete set null default auth.uid(),
  assignee_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id),
  due_date date,
  status public.task_status not null default 'new',
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks(assignee_id);

create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  content text,
  from_status public.task_status,
  to_status public.task_status,
  created_at timestamptz not null default now()
);

-- ---------- Tài liệu & thực đơn ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  academic_year_id uuid references public.academic_years(id),
  department_id uuid references public.departments(id),
  doc_type text not null default 'Khác',
  access_level public.doc_access not null default 'all_staff',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.events add constraint events_document_fk foreign key (document_id) references public.documents(id) on delete set null;
alter table public.tasks add constraint tasks_document_fk foreign key (document_id) references public.documents(id) on delete set null;

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,         -- thứ Hai của tuần
  items jsonb not null default '{}'::jsonb, -- {"mon": "...", "tue": "...", ...}
  note text,
  status public.menu_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- Nhật ký ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,                    -- insert / update / delete / export / approve ...
  entity text not null,
  entity_id text,
  detail jsonb,                            -- chỉ tên cột thay đổi / lý do, không chứa dữ liệu cá nhân
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- ---------- Cấu hình ứng dụng ----------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(key, value) values
  ('announcement_requires_approval', 'true'::jsonb),
  ('attendance_edit_requires_reason', 'true'::jsonb),
  ('document_max_mb', '10'::jsonb),
  ('document_allowed_ext', '["pdf","doc","docx","xls","xlsx","ppt","pptx","png","jpg","jpeg"]'::jsonb),
  ('parent_portal_enabled', 'false'::jsonb);

-- ---------- Dữ liệu cấu hình cơ bản (không phải dữ liệu cá nhân) ----------
insert into public.school_levels(code, name, is_active, sort_order) values
  ('TH', 'Tiểu học', true, 1),
  ('THCS', 'Trung học cơ sở', true, 2),
  ('THPT', 'Trung học phổ thông', false, 3);

insert into public.grades(level_id, grade_number, name)
select l.id, g, 'Khối ' || g from public.school_levels l, generate_series(1, 5) g where l.code = 'TH';
insert into public.grades(level_id, grade_number, name)
select l.id, g, 'Khối ' || g from public.school_levels l, generate_series(6, 9) g where l.code = 'THCS';
insert into public.grades(level_id, grade_number, name)
select l.id, g, 'Khối ' || g from public.school_levels l, generate_series(10, 12) g where l.code = 'THPT';

insert into public.departments(code, name, level_id) values
  ('HDT', 'Hội đồng trường', null),
  ('BGH', 'Ban Giám hiệu', null),
  ('TH', 'Khối Tiểu học', (select id from public.school_levels where code = 'TH')),
  ('THCS', 'Khối THCS', (select id from public.school_levels where code = 'THCS')),
  ('VP', 'Tổ Văn phòng', null),
  ('NT', 'Tổ Nghệ thuật', null);

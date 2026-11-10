-- Thông báo "đã lên lịch" tự hiển thị khi tới thời gian phát hành
create or replace function app.announcement_visible(a public.announcements) returns boolean
language sql stable security definer set search_path = '' as $$
  select a.status in ('published', 'scheduled')
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

-- Thu hồi quyền gọi RPC từ người chưa đăng nhập; mọi hàm đều tự kiểm tra quyền bên trong
revoke execute on function public.activate_year(uuid) from public, anon;
revoke execute on function public.copy_classes_from_year(uuid, uuid) from public, anon;
revoke execute on function public.log_event(text, text, text, jsonb) from public, anon;
revoke execute on function public.report_attendance_day(uuid, date) from public, anon;
revoke execute on function public.report_enrollment_summary(uuid) from public, anon;
revoke execute on function public.save_attendance(uuid, date, public.attendance_session_type, jsonb, boolean, text) from public, anon;
revoke execute on function public.transfer_student(uuid, uuid, text) from public, anon;
alter function app.touch_updated_at() set search_path = '';

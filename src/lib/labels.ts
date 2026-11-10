export const STUDENT_STATUS: Record<string, string> = {
  studying: "Đang học", transferred_out: "Đã chuyển trường", dropped: "Thôi học", graduated: "Đã tốt nghiệp",
};
export const STAFF_STATUS: Record<string, string> = { working: "Đang làm việc", on_leave: "Tạm nghỉ", resigned: "Đã nghỉ việc" };
export const YEAR_STATUS: Record<string, string> = { draft: "Bản nháp", active: "Đang hoạt động", locked: "Đã khóa (chỉ đọc)", archived: "Lưu trữ" };
export const CLASS_STATUS: Record<string, string> = { active: "Hoạt động", ended: "Kết thúc", archived: "Lưu trữ" };
export const ATT_STATUS: Record<string, string> = { present: "Có mặt", excused: "Nghỉ có phép", unexcused: "Nghỉ không phép", late: "Đi muộn" };
export const ATT_SESSION: Record<string, string> = { full_day: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" };
export const ANN_STATUS: Record<string, string> = {
  draft: "Nháp", pending: "Chờ duyệt", scheduled: "Đã lên lịch", published: "Đã phát hành", archived: "Đã thu hồi / lưu trữ",
};
export const ANN_AUDIENCE: Record<string, string> = {
  all: "Toàn trường", staff: "Toàn bộ cán bộ, nhân viên", level: "Cấp học", class: "Lớp", department: "Tổ / bộ phận", role: "Nhóm vai trò",
};
export const PRIORITY: Record<string, string> = { normal: "Bình thường", high: "Quan trọng", urgent: "Khẩn" };
export const TASK_STATUS: Record<string, string> = { new: "Mới", in_progress: "Đang xử lý", waiting: "Chờ phản hồi", done: "Hoàn thành", overdue: "Quá hạn" };
export const DOC_ACCESS: Record<string, string> = { all_staff: "Toàn bộ cán bộ, nhân viên", department: "Chỉ tổ / bộ phận", leadership: "Ban Giám hiệu & Hội đồng trường" };
export const GENDER: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };
export const DOC_TYPES = ["Công văn", "Quyết định", "Kế hoạch", "Báo cáo", "Biểu mẫu", "Chuyên môn", "Khác"];

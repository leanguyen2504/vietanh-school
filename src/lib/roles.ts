export type AppRole = "admin" | "board" | "principal" | "head" | "teacher" | "office" | "health" | "parent";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị hệ thống",
  board: "Hội đồng trường",
  principal: "Ban Giám hiệu",
  head: "Tổ trưởng / Trưởng bộ phận",
  teacher: "Giáo viên",
  office: "Nhân viên văn phòng",
  health: "Nhân viên y tế / bán trú",
  parent: "Phụ huynh",
};

export type ModuleKey =
  | "dashboard" | "students" | "classes" | "staff" | "attendance" | "events" | "announcements"
  | "tasks" | "documents" | "menus" | "reports" | "settings";

/** Module hiển thị theo vai trò. Quyền thật được kiểm tra ở database (RLS) và server action. */
export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ["admin", "board", "principal", "head", "teacher", "office", "health"],
  students: ["admin", "principal", "head", "teacher", "office", "health"],
  classes: ["admin", "principal", "head", "teacher", "office", "health", "board"],
  staff: ["admin", "principal", "head", "teacher", "office", "health", "board"],
  attendance: ["admin", "principal", "head", "teacher", "office"],
  events: ["admin", "board", "principal", "head", "teacher", "office", "health"],
  announcements: ["admin", "board", "principal", "head", "teacher", "office", "health"],
  tasks: ["admin", "principal", "head", "teacher", "office", "health"],
  documents: ["admin", "board", "principal", "head", "teacher", "office", "health"],
  menus: ["admin", "board", "principal", "head", "teacher", "office", "health"],
  reports: ["admin", "board", "principal", "head", "office"],
  settings: ["admin"],
};

export const can = (role: AppRole | null | undefined, roles: AppRole[]) => !!role && roles.includes(role);

export const PERMS = {
  manageStudents: ["admin", "principal", "office"] as AppRole[],
  manageStaff: ["admin", "principal", "office"] as AppRole[],
  manageClasses: ["admin", "principal"] as AppRole[],
  composeAnnouncement: ["admin", "principal", "head", "office"] as AppRole[],
  approveAnnouncement: ["admin", "principal"] as AppRole[],
  manageEvents: ["admin", "principal", "office", "head"] as AppRole[],
  uploadDocuments: ["admin", "principal", "office", "head"] as AppRole[],
  editMenus: ["admin", "principal", "office", "health"] as AppRole[],
  publishMenus: ["admin", "principal"] as AppRole[],
  exportPersonal: ["admin", "principal", "office"] as AppRole[],
  createTasks: ["admin", "principal", "head", "teacher", "office", "health"] as AppRole[],
  attendanceOverview: ["admin", "principal", "head", "office"] as AppRole[],
};

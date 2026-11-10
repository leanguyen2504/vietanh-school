export type AppRole = "admin" | "owner" | "board" | "principal" | "head" | "teacher" | "office" | "accountant" | "health" | "parent";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị hệ thống",
  owner: "Chủ đầu tư",
  board: "Hội đồng trường",
  principal: "Ban Giám hiệu",
  head: "Tổ trưởng / Trưởng bộ phận",
  teacher: "Giáo viên",
  office: "Nhân viên văn phòng",
  accountant: "Kế toán",
  health: "Nhân viên y tế / bán trú",
  parent: "Phụ huynh",
};

export type ModuleKey =
  | "dashboard" | "students" | "classes" | "staff" | "attendance" | "events" | "announcements"
  | "tasks" | "documents" | "menus" | "reports" | "settings" | "finance" | "owner" | "search";

/** Module hiển thị theo vai trò. Chủ đầu tư có mọi quyền của Ban Giám hiệu (xem hàm can). Quyền thật được kiểm tra ở database (RLS) và server action. */
export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
  students: ["admin", "principal", "head", "teacher", "office", "health"],
  classes: ["admin", "principal", "head", "teacher", "office", "health", "board"],
  staff: ["admin", "principal", "head", "teacher", "office", "health", "board"],
  attendance: ["admin", "principal", "head", "teacher", "office"],
  events: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
  announcements: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
  tasks: ["admin", "principal", "head", "teacher", "office", "accountant", "health"],
  documents: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
  menus: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
  reports: ["admin", "board", "principal", "head", "office"],
  settings: ["admin"],
  finance: ["principal", "accountant"],
  owner: ["owner"],
  search: ["admin", "board", "principal", "head", "teacher", "office", "accountant", "health"],
};

/** Chủ đầu tư được coi như Ban Giám hiệu ở mọi chỗ kiểm tra quyền (giống hàm app.is_role trong database). */
export const can = (role: AppRole | null | undefined, roles: AppRole[]) =>
  !!role && (roles.includes(role) || (role === "owner" && roles.includes("principal")));

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
  /** Ghi sổ thu/chi: Kế toán (chờ duyệt) và Chủ đầu tư (tự duyệt) */
  financeEntry: ["owner", "accountant"] as AppRole[],
  /** Duyệt / từ chối khoản thu/chi: BGH và Chủ đầu tư */
  financeApprove: ["principal"] as AppRole[],
  /** Quản lý hạng mục, sửa/xóa khoản đã duyệt: chỉ Chủ đầu tư */
  financeAdmin: ["owner"] as AppRole[],
};

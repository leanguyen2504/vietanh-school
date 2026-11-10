"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbError, guard, isErr, type ActionState } from "@/lib/auth";
import { PERMS } from "@/lib/roles";

const str = (max = 200) => z.string().trim().max(max);
const optStr = (max = 200) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optDate = z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));

const StudentSchema = z.object({
  code: str(30).min(1, "Cần mã học sinh"),
  full_name: str(120).min(2, "Cần họ tên"),
  date_of_birth: optDate,
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")).transform((v) => v || null),
  admission_date: optDate,
});

const GuardianSchema = z.object({
  g_name: optStr(120),
  g_relationship: optStr(40),
  g_phone: z.string().trim().max(20).regex(/^[0-9+ .-]*$/, "Số điện thoại không hợp lệ").optional().transform((v) => v || null),
  g_email: z.string().trim().email("Email không hợp lệ").optional().or(z.literal("")).transform((v) => v || null),
});

function first(e: z.ZodError) {
  return e.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

export async function createStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const s = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: first(s.error) };
  const g = GuardianSchema.safeParse(Object.fromEntries(fd));
  if (!g.success) return { error: first(g.error) };
  const classId = String(fd.get("class_id") ?? "");
  if (!ctx.year) return { error: "Chưa có năm học." };

  const { data: st, error } = await ctx.supabase.from("students").insert(s.data).select("id").single();
  if (error) return { error: dbError(error) };

  if (g.data.g_name) {
    const { data: gd, error: ge } = await ctx.supabase.from("guardians")
      .insert({ full_name: g.data.g_name, phone: g.data.g_phone, email: g.data.g_email }).select("id").single();
    if (ge) return { error: "Đã tạo học sinh nhưng lỗi khi lưu người giám hộ: " + dbError(ge) };
    await ctx.supabase.from("student_guardians").insert({ student_id: st.id, guardian_id: gd.id, relationship: g.data.g_relationship ?? "Người giám hộ", is_primary: true });
  }
  if (classId) {
    const { error: ee } = await ctx.supabase.from("enrollments").insert({
      student_id: st.id, class_id: classId, academic_year_id: ctx.year.id, start_date: s.data.admission_date ?? undefined, created_by: ctx.userId,
    });
    if (ee) return { error: "Đã tạo học sinh nhưng chưa xếp lớp: " + dbError(ee) };
  }
  revalidatePath("/students");
  redirect(`/students/${st.id}?created=1`);
}

export async function updateStudent(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const s = StudentSchema.safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: first(s.error) };
  const { error } = await ctx.supabase.from("students").update(s.data).eq("id", id);
  if (error) return { error: dbError(error) };
  revalidatePath(`/students/${id}`);
  return { ok: true, message: "Đã lưu thông tin học sinh." };
}

export async function changeStudentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const status = z.enum(["studying", "transferred_out", "dropped", "graduated"]).safeParse(fd.get("status"));
  if (!status.success) return { error: "Trạng thái không hợp lệ" };
  const leaveDate = String(fd.get("leave_date") || "") || new Date().toISOString().slice(0, 10);
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  const leaving = status.data !== "studying";
  const { error } = await ctx.supabase.from("students").update({ status: status.data, leave_date: leaving ? leaveDate : null }).eq("id", id);
  if (error) return { error: dbError(error) };
  if (leaving) {
    await ctx.supabase.from("enrollments").update({ status: "ended", end_date: leaveDate, note: note || null }).eq("student_id", id).eq("status", "active");
  }
  if (note) await ctx.supabase.from("student_notes").insert({ student_id: id, content: `[Đổi trạng thái] ${note}`, created_by: ctx.userId });
  revalidatePath(`/students/${id}`);
  return { ok: true, message: "Đã cập nhật trạng thái học tập." };
}

export async function transferClass(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const classId = String(fd.get("class_id") ?? "");
  if (!classId) return { error: "Chọn lớp mới." };
  const { error } = await ctx.supabase.rpc("transfer_student", { p_student: id, p_new_class: classId, p_note: String(fd.get("note") ?? "") || null });
  if (error) return { error: dbError(error) };
  revalidatePath(`/students/${id}`);
  return { ok: true, message: "Đã xếp/chuyển lớp. Lịch sử lớp cũ được giữ lại." };
}

export async function addGuardian(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const g = GuardianSchema.safeParse(Object.fromEntries(fd));
  if (!g.success) return { error: first(g.error) };
  if (!g.data.g_name) return { error: "Cần họ tên người giám hộ." };
  const isPrimary = fd.get("is_primary") === "on";
  const { data: gd, error } = await ctx.supabase.from("guardians").insert({ full_name: g.data.g_name, phone: g.data.g_phone, email: g.data.g_email }).select("id").single();
  if (error) return { error: dbError(error) };
  if (isPrimary) await ctx.supabase.from("student_guardians").update({ is_primary: false }).eq("student_id", id);
  const { error: e2 } = await ctx.supabase.from("student_guardians").insert({ student_id: id, guardian_id: gd.id, relationship: g.data.g_relationship ?? "Người giám hộ", is_primary: isPrimary });
  if (e2) return { error: dbError(e2) };
  revalidatePath(`/students/${id}`);
  return { ok: true, message: "Đã thêm người giám hộ." };
}

export async function removeGuardian(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const sid = String(fd.get("student_id"));
  const { error } = await ctx.supabase.from("student_guardians").delete().eq("student_id", sid).eq("guardian_id", String(fd.get("guardian_id")));
  if (error) return { error: dbError(error) };
  revalidatePath(`/students/${sid}`);
  return { ok: true, message: "Đã gỡ liên kết người giám hộ." };
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  const id = String(fd.get("id"));
  const content = String(fd.get("content") ?? "").trim();
  if (!content) return { error: "Nội dung trống." };
  const { error } = await ctx.supabase.from("student_notes").insert({ student_id: id, content: content.slice(0, 2000), created_by: ctx.userId });
  if (error) return { error: dbError(error) };
  revalidatePath(`/students/${id}`);
  return { ok: true, message: "Đã thêm ghi chú." };
}

// ---------- Nhập CSV ----------
export type ImportRow = {
  line: number; code: string; full_name: string; date_of_birth: string | null; gender: string | null; class_name: string;
  guardian_name: string; guardian_relationship: string; guardian_phone: string; errors: string[];
};

export async function importStudents(rows: ImportRow[]): Promise<ActionState> {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return ctx;
  if (!ctx.year) return { error: "Chưa có năm học." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Không có dòng hợp lệ." };
  if (rows.length > 2000) return { error: "Tối đa 2000 dòng mỗi lần nhập." };

  const { data: classes } = await ctx.supabase.from("classes").select("id, name").eq("academic_year_id", ctx.year.id);
  const classMap = new Map((classes ?? []).map((c: any) => [c.name.toLowerCase(), c.id]));
  let ok = 0;
  const failed: string[] = [];
  for (const r of rows) {
    // Kiểm tra lại phía server, không tin dữ liệu xem trước từ trình duyệt
    const s = StudentSchema.safeParse({ code: r.code, full_name: r.full_name, date_of_birth: r.date_of_birth ?? undefined, gender: r.gender ?? "" });
    if (!s.success) { failed.push(`Dòng ${r.line}: ${first(s.error)}`); continue; }
    const { data: st, error } = await ctx.supabase.from("students").insert({ ...s.data, admission_date: new Date().toISOString().slice(0, 10) }).select("id").single();
    if (error) { failed.push(`Dòng ${r.line}: ${dbError(error)}`); continue; }
    const cid = classMap.get((r.class_name ?? "").toLowerCase());
    if (cid) await ctx.supabase.from("enrollments").insert({ student_id: st.id, class_id: cid, academic_year_id: ctx.year.id, created_by: ctx.userId });
    if (r.guardian_name) {
      const { data: g } = await ctx.supabase.from("guardians").insert({ full_name: r.guardian_name.slice(0, 120), phone: (r.guardian_phone || "").slice(0, 20) || null }).select("id").single();
      if (g) await ctx.supabase.from("student_guardians").insert({ student_id: st.id, guardian_id: g.id, relationship: r.guardian_relationship || "Người giám hộ", is_primary: true });
    }
    ok++;
  }
  await ctx.supabase.rpc("log_event", { p_action: "import", p_entity: "students", p_detail: { rows: rows.length, ok } });
  revalidatePath("/students");
  return { ok: failed.length === 0, message: `Đã nhập ${ok}/${rows.length} học sinh.`, data: failed };
}

export async function checkImport(codes: string[]) {
  const ctx = await guard(PERMS.manageStudents);
  if (isErr(ctx)) return { existing: [] as string[], classes: [] as string[] };
  const { data } = await ctx.supabase.from("students").select("code").in("code", codes.slice(0, 2000));
  const { data: cl } = ctx.year ? await ctx.supabase.from("classes").select("name").eq("academic_year_id", ctx.year.id) : { data: [] };
  return { existing: (data ?? []).map((d: any) => d.code as string), classes: (cl ?? []).map((c: any) => c.name as string) };
}

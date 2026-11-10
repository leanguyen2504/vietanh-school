"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function chooseYear(fd: FormData) {
  const id = String(fd.get("year_id") ?? "");
  if (/^[0-9a-f-]{36}$/.test(id)) {
    (await cookies()).set("year_id", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  }
  revalidatePath("/", "layout");
}

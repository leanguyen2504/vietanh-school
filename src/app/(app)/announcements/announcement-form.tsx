"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { ANN_AUDIENCE, PRIORITY } from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/roles";
import { saveAnnouncement } from "./actions";

type Opt = { id: string; name: string };

export function AnnouncementForm({ a, levels, classes, departments, canPublish, publishAtLocal, expiresAtLocal }: {
  a?: any; levels: Opt[]; classes: Opt[]; departments: Opt[]; canPublish: boolean; publishAtLocal?: string; expiresAtLocal?: string;
}) {
  const [aud, setAud] = useState<string>(a?.audience_type ?? "staff");
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState(a?.title ?? "");
  const [body, setBody] = useState(a?.body ?? "");
  const opts = aud === "level" ? levels : aud === "class" ? classes : aud === "department" ? departments : [];
  const selected = new Set<string>(a?.audience_ids ?? []);

  return (
    <ActionForm action={saveAnnouncement} className="space-y-4">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Field label="Tiêu đề *"><input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="input" /></Field>
          <Field label="Nội dung *" hint="Không đưa dữ liệu nhạy cảm của học sinh vào thông báo.">
            <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={10} className="input" />
          </Field>
          <Field label="Tệp đính kèm" hint={a?.attachment_path ? "Đã có tệp đính kèm; chọn tệp mới để thay thế." : "PDF, Word, Excel, ảnh… theo cấu hình"}>
            <input type="file" name="attachment" className="text-sm" />
          </Field>
        </div>
        <div className="space-y-4">
          <Field label="Gửi tới">
            <select name="audience_type" value={aud} onChange={(e) => setAud(e.target.value)} className="input">
              {Object.entries(ANN_AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {opts.length > 0 && (
            <fieldset className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2 text-sm">
              <legend className="px-1 text-xs text-muted">Chọn nhóm nhận</legend>
              {opts.map((o) => <label key={o.id} className="flex items-center gap-2"><input type="checkbox" name="audience_ids" value={o.id} defaultChecked={selected.has(o.id)} /> {o.name}</label>)}
            </fieldset>
          )}
          {aud === "role" && (
            <fieldset className="space-y-1 rounded-lg border border-line p-2 text-sm">
              <legend className="px-1 text-xs text-muted">Chọn vai trò</legend>
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== "parent").map(([k, v]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" name="audience_roles" value={k} defaultChecked={a?.audience_roles?.includes(k)} /> {v}</label>)}
            </fieldset>
          )}
          <Field label="Mức độ ưu tiên">
            <select name="priority" defaultValue={a?.priority ?? "normal"} className="input">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Thời gian phát hành" hint="Để trống = phát hành ngay khi được duyệt"><input type="datetime-local" name="publish_at" defaultValue={publishAtLocal} className="input" /></Field>
          <Field label="Hết hiệu lực"><input type="datetime-local" name="expires_at" defaultValue={expiresAtLocal} className="input" /></Field>
        </div>
      </div>

      <div>
        <button type="button" className="text-sm font-medium text-brand-dark hover:underline" onClick={() => setPreview((v) => !v)}>{preview ? "Ẩn xem trước" : "Xem trước"}</button>
        {preview && (
          <article className="mt-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
            <h3 className="text-lg font-semibold">{title || "(Chưa có tiêu đề)"}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{body || "(Chưa có nội dung)"}</p>
          </article>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <SubmitButton variant="secondary" name="intent" value="draft">Lưu nháp</SubmitButton>
        {canPublish ? (
          <SubmitButton name="intent" value="publish" pendingText="Đang phát hành…">Phát hành</SubmitButton>
        ) : (
          <SubmitButton name="intent" value="submit" pendingText="Đang gửi…">Gửi duyệt</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}

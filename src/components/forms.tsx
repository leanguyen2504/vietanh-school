"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Alert, btn } from "@/components/ui";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: any };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SubmitButton({ children, variant = "primary", pendingText = "Đang lưu…", name, value, className }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; pendingText?: string; name?: string; value?: string; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${btn(variant)} ${className ?? ""}`}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

/** Form gọi server action, hiển thị trạng thái thành công / lỗi */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; confirm?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {(state.error || state.message) && (
        <div className="mt-3">
          <Alert tone={state.error ? "danger" : "success"}>{state.error ?? state.message}</Alert>
        </div>
      )}
    </form>
  );
}

/** Nút đơn lẻ gọi action (có xác nhận trước thao tác phá hủy) */
export function ActionButton({ action, fields, children, variant = "secondary", confirm }: {
  action: Action; fields: Record<string, string>; children: React.ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; confirm?: string;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} pendingText="Đang xử lý…">{children}</SubmitButton>
    </ActionForm>
  );
}

"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label = "Trimite linkul magic" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-[10px] bg-action px-4 py-2 font-semibold text-action-foreground hover:bg-action-hover active:brightness-95 disabled:opacity-50"
    >
      {pending ? "Se trimite…" : label}
    </button>
  );
}

"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startConversation } from "@/app/chat/actions";

export function HomeComposer() {
  return (
    <form
      action={startConversation}
      className="flex min-h-[3.625rem] w-full items-end gap-2 rounded-[1.75rem] border border-zinc-600 bg-zinc-800 p-2 pl-4 shadow-lg shadow-black/20 md:min-h-24 md:p-3 md:pl-5"
    >
      <ComposerFields />
    </form>
  );
}

function ComposerFields() {
  const { pending } = useFormStatus();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }

  return (
    <>
      <textarea
        ref={textareaRef}
        name="q"
        rows={1}
        required
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          resize();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && value.trim() && !pending) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Am nevoie de ..."
        className="h-10 max-h-24 min-h-10 flex-1 resize-none bg-transparent py-2 text-left text-sm leading-6 text-white outline-none placeholder:text-zinc-400 md:self-start md:text-base"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        aria-label={pending ? "Se trimite" : "Trimite"}
        aria-busy={pending}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground transition hover:bg-action-hover active:brightness-95 disabled:bg-surface-raised disabled:text-secondary"
      >
        {pending ? <SpinnerIcon /> : <ArrowUpIcon />}
      </button>
    </>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 16V4m0 0L5.5 8.5M10 4l4.5 4.5" />
    </svg>
  );
}

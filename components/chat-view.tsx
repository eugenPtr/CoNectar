"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { MEMBER_MESSAGE_CAP } from "@/lib/people-search/conversations";
import { isInternalHref } from "@/lib/people-search/link-safety";

// Render-time link whitelist (story 31): only internal Member-facing links
// render as anchors; anything else collapses to its text. A hallucinated
// external link can never become a clickable anchor.
type MarkdownComponents = NonNullable<ComponentProps<typeof Streamdown>["components"]>;
const markdownComponents: MarkdownComponents = {
  a({ href, children }) {
    if (isInternalHref(href)) {
      return (
        <a
          href={href}
          className={`font-medium underline hover:opacity-80 ${href?.startsWith("/profile/") ? "text-accent-text" : "text-foreground"}`}
        >
          {children}
        </a>
      );
    }
    return <>{children}</>;
  },
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatView({
  conversationId,
  initialMessages,
  initialQuery,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
  });

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const memberMessages = messages.filter((m) => m.role === "user").length;
  const atCap = memberMessages >= MEMBER_MESSAGE_CAP;
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const waitingForReply = busy && (!lastMessage || lastMessage.role === "user" ||
    (lastMessage.role === "assistant" && !messageText(lastMessage).trim()));
  const wasBusy = useRef(false);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (wasBusy.current) {
      wasBusy.current = false;
      router.refresh();
    }
  }, [busy, router]);

  // First send from the home route arrives as ?q=...; fire it once.
  const autoSent = useRef(false);
  useEffect(() => {
    if (initialQuery && !autoSent.current && initialMessages.length === 0) {
      autoSent.current = true;
      sendMessage({ text: initialQuery });
    }
  }, [initialQuery, initialMessages.length, sendMessage]);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waitingForReply]);

  useEffect(() => {
    if (error) toast.error("Ceva n-a mers. Încearcă din nou.");
  }, [error]);

  function resizeComposer() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }

  function submit() {
    const text = input.trim();
    if (!text || busy || atCap) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage({ text });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-action px-4 py-2 text-sm text-action-foreground">
                {messageText(message)}
              </div>
            </div>
          ) : messageText(message) ? (
            <div key={message.id} className="flex justify-start">
              <div className="prose prose-sm max-w-[80%] rounded-2xl border border-border-subtle bg-surface px-4 py-2 text-sm text-foreground">
                <Streamdown components={markdownComponents}>
                  {messageText(message)}
                </Streamdown>
              </div>
            </div>
          ) : null,
        )}
        {waitingForReply && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-sm text-secondary">
              <span>Pregătesc răspunsul</span>
              <span className="flex items-center gap-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 animate-bounce rounded-full bg-accent-text motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 bg-background px-4 pb-3 pt-2">
        {atCap ? (
          <p className="text-center text-sm text-zinc-300">
            Ai atins limita de {MEMBER_MESSAGE_CAP} mesaje.{" "}
            <Link href="/" className="text-accent-text underline">
              Începe o conversație nouă
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="flex w-full items-end gap-2 rounded-[1.75rem] border border-zinc-600 bg-zinc-800 p-2 pl-4 shadow-lg shadow-black/20 focus-within:border-focus-ring">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeComposer();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Am nevoie de ..."
                style={{ outline: "none" }}
                className="max-h-24 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-white placeholder:text-zinc-400"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy || !input.trim()}
                aria-label="Trimite"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground transition hover:bg-action-hover active:brightness-95 disabled:bg-surface-raised disabled:text-secondary"
              >
                <ArrowUpIcon />
              </button>
            </div>
            <p className="mt-1 text-right text-xs text-zinc-500">
              {memberMessages}/{MEMBER_MESSAGE_CAP} mesaje
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 16V4m0 0L5.5 8.5M10 4l4.5 4.5" />
    </svg>
  );
}

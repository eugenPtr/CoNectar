"use client";

import { useLayoutEffect, useRef, type ChangeEvent, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  singleLine?: boolean;
};

const MAX_VISIBLE_LINES = 5;

export function AutoGrowingTextarea({
  className,
  onChange,
  onKeyDown,
  singleLine = false,
  value,
  autoFocus,
  ...props
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const width = useRef(0);
  const scrollToEnd = useRef(false);

  function resize() {
    const element = ref.current;
    if (!element) return;

    element.style.height = "auto";
    const styles = getComputedStyle(element);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const border = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
    const chrome = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0) + border;
    const maxHeight = MAX_VISIBLE_LINES * lineHeight + chrome;
    const naturalHeight = element.scrollHeight + border;
    element.style.height = `${Math.min(naturalHeight, maxHeight)}px`;
    element.style.overflowY = naturalHeight > maxHeight ? "auto" : "hidden";

    if (scrollToEnd.current) {
      element.scrollTop = element.scrollHeight;
      scrollToEnd.current = false;
    }
  }

  useLayoutEffect(() => {
    resize();
  }, [value]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (autoFocus && document.activeElement === element) {
      element.setSelectionRange(element.value.length, element.value.length);
      scrollToEnd.current = true;
      resize();
    }
    width.current = element.clientWidth;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width.current) return;
      width.current = element.clientWidth;
      resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoFocus]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const element = event.currentTarget;
    if (singleLine && /[\r\n]/.test(element.value)) {
      const beforeCaret = element.value.slice(0, element.selectionStart).replace(/[\r\n]+/g, " ");
      element.value = element.value.replace(/[\r\n]+/g, " ");
      element.setSelectionRange(beforeCaret.length, beforeCaret.length);
    }
    scrollToEnd.current = element.selectionStart === element.value.length
      && element.selectionEnd === element.value.length;
    onChange?.(event);
  }

  return <textarea
    {...props}
    ref={ref}
    rows={1}
    value={value}
    autoFocus={autoFocus}
    onChange={handleChange}
    onKeyDown={(event) => {
      if (singleLine && event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
      onKeyDown?.(event);
    }}
    className={`block min-h-11 w-full resize-none leading-5 ${className ?? ""}`}
  />;
}

// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AutoGrowingTextarea } from "@/components/auto-growing-textarea";

function Harness({ initial = "", singleLine = false }: { initial?: string; singleLine?: boolean }) {
  const [value, setValue] = useState(initial);
  return <AutoGrowingTextarea aria-label="Details" autoFocus singleLine={singleLine}
    value={value} onChange={(event) => setValue(event.target.value)} />;
}

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");

afterEach(() => {
  cleanup();
  if (originalScrollHeight) Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
  else delete (HTMLTextAreaElement.prototype as unknown as { scrollHeight?: number }).scrollHeight;
});

describe("AutoGrowingTextarea", () => {
  it("shows at most five lines for prefilled text and resizes when content shrinks", () => {
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() { return this.value.split("\n").length * 20; },
    });
    render(<Harness initial={"one\ntwo\nthree\nfour\nfive\nsix\nseven"} />);
    const field = screen.getByRole("textbox", { name: "Details" }) as HTMLTextAreaElement;
    const cappedHeight = parseFloat(field.style.height);
    expect(cappedHeight).toBeLessThan(140);
    expect(field.style.overflowY).toBe("auto");
    expect(field.selectionStart).toBe(field.value.length);

    fireEvent.change(field, { target: { value: "one\ntwo" } });
    expect(parseFloat(field.style.height)).toBeLessThan(cappedHeight);
    expect(field.style.overflowY).toBe("hidden");
  });

  it("keeps short labels as one logical line", async () => {
    const user = userEvent.setup();
    render(<Harness singleLine />);
    const field = screen.getByRole("textbox", { name: "Details" });
    await user.type(field, "First{Enter}Last");
    expect(field).toHaveValue("FirstLast");
    fireEvent.change(field, { target: { value: "First\nLast" } });
    expect(field).toHaveValue("First Last");
  });
});

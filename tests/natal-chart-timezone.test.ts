import { describe, expect, it } from "vitest";
import { historicalUtcOffset } from "@/supabase/functions/generate-natal-chart/timezone";

describe("historicalUtcOffset", () => {
  it("uses the Romanian winter and summer offsets at the birth date", () => {
    expect(historicalUtcOffset("1990-01-12", "14:30", "Europe/Bucharest")).toBe(2);
    expect(historicalUtcOffset("1990-07-12", "14:30", "Europe/Bucharest")).toBe(3);
  });

  it("supports negative and fractional offsets", () => {
    expect(historicalUtcOffset("2000-01-12", "14:30", "America/New_York")).toBe(-5);
    expect(historicalUtcOffset("2000-01-12", "14:30", "Asia/Kolkata")).toBe(5.5);
  });

  it("rejects a local time skipped by daylight saving", () => {
    expect(() => historicalUtcOffset("2024-03-31", "03:30", "Europe/Bucharest")).toThrow();
  });
});

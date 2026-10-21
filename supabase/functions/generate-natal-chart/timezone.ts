// Resolve the UTC offset that applied at the entered local birth time, rather
// than using today's offset for the birthplace. This covers historical DST.
export function historicalUtcOffset(date: string, time: string, timezone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, timeZoneName: "longOffset", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const requestedAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const label = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    if (label === "GMT") return 0;
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/.exec(label);
    if (!match) throw new Error("Unsupported historical timezone offset");
    const seconds = Number(match[2]) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
    return (match[1] === "+" ? 1 : -1) * seconds / 3600;
  };
  let instant = requestedAsUtc;
  for (let index = 0; index < 4; index++) {
    const next = requestedAsUtc - offsetAt(instant) * 3_600_000;
    if (next === instant) break;
    instant = next;
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  if (Number(parts.year) !== year || Number(parts.month) !== month || Number(parts.day) !== day
    || Number(parts.hour) !== hour || Number(parts.minute) !== minute) {
    throw new Error("Birth time does not exist in the selected timezone");
  }
  return offsetAt(instant);
}

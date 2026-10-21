export interface BirthDataInput {
  birthDate: string;
  birthTime: string;
  birthplace: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isVisible: boolean;
}

export interface BirthDataDraft {
  birthDate: string;
  birthTime: string;
  birthplace: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  isVisible: boolean;
}

export const emptyBirthData: BirthDataDraft = {
  birthDate: "", birthTime: "", birthplace: "", latitude: null,
  longitude: null, timezone: "", isVisible: true,
};

export function validBirthData(value: BirthDataDraft): value is BirthDataDraft & BirthDataInput {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value.birthDate) ? new Date(`${value.birthDate}T12:00:00Z`) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value.birthDate)
    && value.birthDate <= new Date().toISOString().slice(0, 10)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.birthTime)
    && value.birthplace.trim().length >= 2
    && value.latitude !== null && Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90
    && value.longitude !== null && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180
    && value.timezone.trim());
}

export function parseBirthData(raw: unknown): BirthDataInput | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  const value: BirthDataDraft = {
    birthDate: typeof input.birthDate === "string" ? input.birthDate : "",
    birthTime: typeof input.birthTime === "string" ? input.birthTime : "",
    birthplace: typeof input.birthplace === "string" ? input.birthplace : "",
    latitude: typeof input.latitude === "number" ? input.latitude : null,
    longitude: typeof input.longitude === "number" ? input.longitude : null,
    timezone: typeof input.timezone === "string" ? input.timezone : "",
    isVisible: input.isVisible === true,
  };
  if (!validBirthData(value) || typeof input.isVisible !== "boolean") return undefined;
  try { new Intl.DateTimeFormat("en", { timeZone: value.timezone }); } catch { return undefined; }
  return value;
}

export function birthDataForRpc(value: BirthDataInput) {
  return {
    birth_date: value.birthDate, birth_time: value.birthTime,
    birthplace: value.birthplace, latitude: value.latitude,
    longitude: value.longitude, timezone: value.timezone,
    is_visible: value.isVisible,
  };
}

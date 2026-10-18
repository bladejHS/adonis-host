import { DAY_MS, startOfDay } from "@adonis/database";

const money0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const lei = (n: number, decimals = false) => `${(decimals ? money2 : money0).format(n)} lei`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;

const dShort = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });
const dLong = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dWeek = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dTime = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });

export const fmtShort = (d: Date) => dShort.format(d);
export const fmtLong = (d: Date) => dLong.format(d);
export const fmtWeekday = (d: Date) => dWeek.format(d);
export const fmtDateTime = (d: Date) => dTime.format(d);
export const fmtRange = (a: Date, b: Date) => `${fmtShort(a)} – ${fmtShort(b)}`;

/** Ziua de azi la miezul nopții UTC (datele de sejur sunt stocate ca date UTC). */
export function today() {
  return startOfDay(new Date());
}
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const parseDay = (s: string) => new Date(s + "T00:00:00.000Z");

export function relTime(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "chiar acum";
  if (mins < 60) return `acum ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  const days = Math.round(h / 24);
  return `acum ${days} ${days === 1 ? "zi" : "zile"}`;
}

export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat("ro-RO", { hour: "numeric", hour12: false, timeZone: "Europe/Bucharest" }).format(new Date()));
  return h < 11 ? "Bună dimineața" : h < 18 ? "Bună ziua" : "Bună seara";
};

export const json = <T,>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

// „1 cameră”, „5 camere”, „20 de camere” (de la 20 în sus, regula românească)
export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : n % 100 >= 20 || (n >= 100 && n % 100 === 0) ? "de " + many : many}`;

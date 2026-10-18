// Formatare și mici componente comune pentru versiunea Pages.
import type { ReactNode } from "react";
import { DAY_MS, startOfDay } from "@adonis/database/pricing";
import { asset } from "./data/store";

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

export const today = () => startOfDay(new Date());
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

// „1 cameră”, „5 camere”, „20 de camere”
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : n % 100 >= 20 || (n >= 100 && n % 100 === 0) ? "de " + many : many}`;

/** Descarcă un fișier generat în browser (CSV, XML, copie de siguranță). */
export function download(name: string, content: string | Blob, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <img src={asset("/brand/adonis-mark.svg")} alt="" className="h-12 w-12 opacity-60" />
      <p className="font-display text-xl text-heading">{title}</p>
      {children && <div className="max-w-sm text-sm text-subtle">{children}</div>}
    </div>
  );
}

export const SOURCE_LABEL: Record<string, string> = { direct: "Direct", phone: "Telefon", booking: "Booking.com", airbnb: "Airbnb", other: "Altele" };
export const ROLE_LABEL: Record<string, string> = { owner: "Proprietar", manager: "Manager", reception: "Recepție", housekeeping: "Curățenie", maintenance: "Întreținere" };
export const ROLE_ACCESS: Record<string, string[]> = {
  owner: ["*"],
  manager: ["*"],
  reception: ["/", "/rezervari", "/calendar", "/oaspeti", "/camere", "/curatenie", "/consumabile", "/mesaje", "/oferte", "/canale", "/facturi", "/cont"],
  housekeeping: ["/curatenie", "/camere", "/consumabile", "/cont"],
  maintenance: ["/curatenie", "/camere", "/cont"],
};
export function canAccess(role: string, path: string) {
  const allowed = ROLE_ACCESS[role] ?? [];
  return allowed.includes("*") || allowed.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
}

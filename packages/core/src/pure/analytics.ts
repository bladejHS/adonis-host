// Sezonalitate și satisfacție, calculate pe liste în memorie.

import { DAY_MS } from "@adonis/database/pricing";

export type Holiday = { date: string; name: string };

/** Momentele care umplu Costineștiul (date fixe + sărbători mobile pe anii folosiți). */
export function holidays(year: number): Holiday[] {
  const easter: Record<number, string> = { 2025: "04-20", 2026: "04-12", 2027: "05-02", 2028: "04-16" };
  const pentecost: Record<number, string> = { 2025: "06-08", 2026: "05-31", 2027: "06-20", 2028: "06-04" };
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: "Anul Nou" },
    { date: `${year}-05-01`, name: "1 Mai" },
    { date: `${year}-06-01`, name: "Ziua Copilului" },
    { date: `${year}-08-15`, name: "Sfânta Maria" },
    { date: `${year}-12-31`, name: "Revelion" },
  ];
  if (easter[year]) list.push({ date: `${year}-${easter[year]}`, name: "Paște" });
  if (pentecost[year]) list.push({ date: `${year}-${pentecost[year]}`, name: "Rusalii" });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

const OCCUPYING = ["confirmed", "checked_in", "checked_out", "pending"];

/** Ocupare și venit pe săptămâni, pentru graficul de sezonalitate. */
export function computeWeeklySeasonality(roomCount: number, reservations: { checkIn: Date; checkOut: Date; totalAmount: number; status: string }[], year: number, fromMonth = 4, toMonth = 10) {
  const from = new Date(Date.UTC(year, fromMonth - 1, 1));
  const to = new Date(Date.UTC(year, toMonth, 1));
  const res = reservations.filter((r) => OCCUPYING.includes(r.status) && r.checkIn < to && r.checkOut > from);
  const weeks: { start: Date; occupancy: number; revenue: number }[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += 7 * DAY_MS) {
    let nights = 0;
    let revenue = 0;
    for (let d = t; d < Math.min(t + 7 * DAY_MS, to.getTime()); d += DAY_MS) {
      for (const r of res) {
        if (r.checkIn.getTime() <= d && r.checkOut.getTime() > d) {
          nights++;
          revenue += r.totalAmount / Math.max(1, Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS));
        }
      }
    }
    weeks.push({ start: new Date(t), occupancy: roomCount ? nights / (roomCount * 7) : 0, revenue });
  }
  return weeks;
}

export type ReviewLike = { id: string; source: string; rating: number; title: string | null; comment: string | null; author: string | null; createdAt: Date; repliedAt: Date | null };

const THEMES: Record<string, string[]> = {
  "Vederea la mare": ["mare", "răsărit", "rasarit", "priveliște", "vedere"],
  Curățenia: ["curat", "curățenie", "curatenie"],
  Personalul: ["gazd", "personal", "amabil", "primitor"],
  Zgomotul: ["zgomot", "gălăgie", "galagie", "muzică"],
  "Prețul": ["preț", "pret", "scump", "raport calitate"],
  Parcarea: ["parcare"],
};

export function computeSatisfaction<R extends ReviewLike>(all: R[]) {
  const reviews = [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const bySource: Record<string, { count: number; avg: number }> = {};
  for (const src of Array.from(new Set(reviews.map((r) => r.source)))) {
    const xs = reviews.filter((r) => r.source === src).map((r) => r.rating);
    bySource[src] = { count: xs.length, avg: avg(xs) };
  }
  const buckets = [
    { label: "Excepțional (9–10)", min: 9, count: 0 },
    { label: "Foarte bine (8–9)", min: 8, count: 0 },
    { label: "Bine (6–8)", min: 6, count: 0 },
    { label: "Slab (sub 6)", min: 0, count: 0 },
  ];
  for (const r of reviews) buckets.find((b) => r.rating >= b.min)!.count++;
  const themes = Object.entries(THEMES)
    .map(([name, words]) => ({ name, count: reviews.filter((r) => words.some((w) => `${r.title ?? ""} ${r.comment ?? ""}`.toLowerCase().includes(w))).length }))
    .sort((a, b) => b.count - a.count);
  return { count: reviews.length, average: avg(reviews.map((r) => r.rating)), bySource, buckets, themes, latest: reviews.slice(0, 8) };
}

export const REVIEW_SOURCE: Record<string, string> = { booking: "Booking.com", airbnb: "Airbnb", google: "Google", direct: "site" };

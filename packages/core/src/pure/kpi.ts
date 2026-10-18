// Indicatori hotelieri calculați pe liste în memorie — folosiți de server (după interogare) și în browser.

import { DAY_MS, nightsBetween } from "@adonis/database/pricing";

export const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in", "checked_out"];

export type KpiReservation = { checkIn: Date; checkOut: Date; totalAmount: number; source: string; status: string };

/** Nopți și venit dintr-o rezervare care cad în intervalul [from, to). Venitul se împarte egal pe nopți. */
export function overlap(r: { checkIn: Date; checkOut: Date; totalAmount: number }, from: Date, to: Date) {
  const a = Math.max(r.checkIn.getTime(), from.getTime());
  const b = Math.min(r.checkOut.getTime(), to.getTime());
  const nights = Math.max(0, Math.round((b - a) / DAY_MS));
  const total = nightsBetween(r.checkIn, r.checkOut) || 1;
  return { nights, revenue: (r.totalAmount * nights) / total };
}

/**
 * Ocupare, ADR, RevPAR, rata de anulare și venit pe canal pentru [from, to).
 * `reservations` poate conține orice rezervări; filtrarea pe stare și interval se face aici.
 */
export function computeKpis(roomCount: number, reservations: KpiReservation[], from: Date, to: Date) {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const active = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status) && r.checkIn < to && r.checkOut > from);
  const cancelled = reservations.filter((r) => (r.status === "cancelled" || r.status === "no_show") && r.checkIn >= from && r.checkIn < to).length;
  let sold = 0;
  let revenue = 0;
  const byChannel: Record<string, { revenue: number; nights: number; count: number }> = {};
  for (const r of active) {
    const o = overlap(r, from, to);
    sold += o.nights;
    revenue += o.revenue;
    const c = (byChannel[r.source] ??= { revenue: 0, nights: 0, count: 0 });
    c.revenue += o.revenue;
    c.nights += o.nights;
    if (r.checkIn >= from && r.checkIn < to) c.count++;
  }
  const available = roomCount * days;
  const arrivals = active.filter((r) => r.checkIn >= from && r.checkIn < to).length;
  return {
    roomCount,
    available,
    sold,
    revenue,
    occupancy: available ? sold / available : 0,
    adr: sold ? revenue / sold : 0,
    revpar: available ? revenue / available : 0,
    cancellationRate: arrivals + cancelled ? cancelled / (arrivals + cancelled) : 0,
    bookings: arrivals,
    byChannel,
  };
}

export type Kpis = ReturnType<typeof computeKpis>;

export function computeMonthlySeries(roomCount: number, reservations: KpiReservation[], year: number, months: number[]) {
  return months.map((m) => ({ month: m, ...computeKpis(roomCount, reservations, new Date(Date.UTC(year, m - 1, 1)), new Date(Date.UTC(year, m, 1))) }));
}

export function computeDailyOccupancy(roomCount: number, reservations: { checkIn: Date; checkOut: Date; status: string }[], from: Date, days: number) {
  const active = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(from.getTime() + i * DAY_MS);
    const occupied = active.filter((r) => r.checkIn <= day && r.checkOut > day).length;
    return { day, occupied, rate: roomCount ? occupied / roomCount : 0 };
  });
}

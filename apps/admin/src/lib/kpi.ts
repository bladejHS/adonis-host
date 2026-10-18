import { prisma } from "./db";
import { DAY_MS, nightsBetween } from "@adonis/database";

const ACTIVE = ["pending", "confirmed", "checked_in", "checked_out"];

type ResLite = { checkIn: Date; checkOut: Date; totalAmount: number; source: string; status: string };

/** Nopți și venit dintr-o rezervare care cad în intervalul [from, to). Venitul se împarte egal pe nopți. */
function overlap(r: ResLite, from: Date, to: Date) {
  const a = Math.max(r.checkIn.getTime(), from.getTime());
  const b = Math.min(r.checkOut.getTime(), to.getTime());
  const nights = Math.max(0, Math.round((b - a) / DAY_MS));
  const total = nightsBetween(r.checkIn, r.checkOut) || 1;
  return { nights, revenue: (r.totalAmount * nights) / total };
}

export async function kpis(from: Date, to: Date) {
  const [roomCount, reservations, cancelled] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({
      where: { status: { in: ACTIVE }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { checkIn: true, checkOut: true, totalAmount: true, source: true, status: true },
    }),
    prisma.reservation.count({ where: { status: { in: ["cancelled", "no_show"] }, checkIn: { gte: from, lt: to } } }),
  ]);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  let sold = 0;
  let revenue = 0;
  const byChannel: Record<string, { revenue: number; nights: number; count: number }> = {};
  for (const r of reservations) {
    const o = overlap(r, from, to);
    sold += o.nights;
    revenue += o.revenue;
    const c = (byChannel[r.source] ??= { revenue: 0, nights: 0, count: 0 });
    c.revenue += o.revenue;
    c.nights += o.nights;
    if (r.checkIn >= from && r.checkIn < to) c.count++;
  }
  const available = roomCount * days;
  const arrivals = reservations.filter((r) => r.checkIn >= from && r.checkIn < to).length;
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

export async function monthlySeries(year: number, months: number[]) {
  const out = [];
  for (const m of months) {
    const from = new Date(Date.UTC(year, m - 1, 1));
    const to = new Date(Date.UTC(year, m, 1));
    const k = await kpis(from, to);
    out.push({ month: m, ...k });
  }
  return out;
}

/** Ocupare pe zile, pentru benzi și grafice. */
export async function dailyOccupancy(from: Date, days: number) {
  const to = new Date(from.getTime() + days * DAY_MS);
  const [roomCount, reservations] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({
      where: { status: { in: ACTIVE }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { checkIn: true, checkOut: true },
    }),
  ]);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(from.getTime() + i * DAY_MS);
    const occ = reservations.filter((r) => r.checkIn <= day && r.checkOut > day).length;
    return { day, occupied: occ, rate: roomCount ? occ / roomCount : 0 };
  });
}

import { prisma, DAY_MS } from "@adonis/database";
import { ACTIVE_STATUSES, computeDailyOccupancy, computeKpis, computeMonthlySeries } from "./pure/kpi";

const select = { checkIn: true, checkOut: true, totalAmount: true, source: true, status: true } as const;

export async function kpis(from: Date, to: Date) {
  const [roomCount, reservations] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({
      where: {
        OR: [
          { status: { in: ACTIVE_STATUSES }, checkIn: { lt: to }, checkOut: { gt: from } },
          { status: { in: ["cancelled", "no_show"] }, checkIn: { gte: from, lt: to } },
        ],
      },
      select,
    }),
  ]);
  return computeKpis(roomCount, reservations, from, to);
}

export async function monthlySeries(year: number, months: number[]) {
  const [roomCount, reservations] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({
      where: { checkIn: { lt: new Date(Date.UTC(year, Math.max(...months), 1)) }, checkOut: { gt: new Date(Date.UTC(year, Math.min(...months) - 1, 1)) } },
      select,
    }),
  ]);
  return computeMonthlySeries(roomCount, reservations, year, months);
}

/** Ocupare pe zile, pentru benzi și grafice. */
export async function dailyOccupancy(from: Date, days: number) {
  const to = new Date(from.getTime() + days * DAY_MS);
  const [roomCount, reservations] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({ where: { status: { in: ACTIVE_STATUSES }, checkIn: { lt: to }, checkOut: { gt: from } }, select: { checkIn: true, checkOut: true, status: true } }),
  ]);
  return computeDailyOccupancy(roomCount, reservations, from, days);
}

// Acces direct la baza demo din teste (pregătire date și verificări).
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? `file:${path.resolve(__dirname, "../packages/database/prisma/dev.db").replace(/\\/g, "/")}` } },
});

/** O rezervare viitoare, confirmată; opțional cu check-in-ul online resetat. */
export async function freshReservation(resetCheckin = true) {
  const r = await prisma.reservation.findFirstOrThrow({
    where: { status: "confirmed", checkIn: { gt: new Date(Date.now() + 2 * 86_400_000) } },
    orderBy: { checkIn: "asc" },
    include: { room: true },
  });
  if (resetCheckin) {
    await prisma.checkinRecord.deleteMany({ where: { reservationId: r.id } });
    await prisma.reservation.update({ where: { id: r.id }, data: { checkinDoneAt: null } });
  }
  return r;
}

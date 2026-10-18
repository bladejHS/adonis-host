// Motor de reguli pentru oferte extra: ce i se arată fiecărui oaspete, în funcție de sezon,
// lungimea sejurului, camera și cât mai e până la sosire.

import { prisma, nightsBetween } from "@adonis/database";

export { parseRules, isEligible, quantityFor, type SeasonalRules } from "./pure/upsell";
import { isEligible, quantityFor } from "./pure/upsell";

export async function offersForReservation(reservationId: string) {
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { room: { include: { roomType: true } }, purchases: true } });
  const offers = await prisma.upsellOffer.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const ctx = { checkIn: r.checkIn, checkOut: r.checkOut, adults: r.adults, roomTypeCode: r.room.roomType.code };
  const bought = new Set(r.purchases.filter((p) => p.status !== "cancelled").map((p) => p.offerId));
  return offers
    .filter((o) => isEligible(o, ctx))
    .map((o) => ({ ...o, quantity: quantityFor(o.unit, r), total: o.price * quantityFor(o.unit, r), bought: bought.has(o.id) }));
}

export async function trackUpsell(offerIds: string[], reservationId: string | null, kind: "view" | "click" | "purchase") {
  if (!offerIds.length) return;
  await prisma.upsellEvent.createMany({ data: offerIds.map((offerId) => ({ offerId, reservationId, kind })) });
}

/** Pâlnia de conversie pe ofertă: afișări → clicuri → cumpărări. */
export async function conversionFunnel() {
  const grouped = await prisma.upsellEvent.groupBy({ by: ["offerId", "kind"], _count: { _all: true } });
  const out: Record<string, { view: number; click: number; purchase: number }> = {};
  for (const g of grouped) {
    const o = (out[g.offerId] ??= { view: 0, click: 0, purchase: 0 });
    o[g.kind as "view" | "click" | "purchase"] = g._count._all;
  }
  return out;
}

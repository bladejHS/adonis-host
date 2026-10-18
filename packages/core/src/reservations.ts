// Rezervări: disponibilitate, ofertă de preț, creare, schimbare de stare.
// Folosit de admin (server actions) și de API (aplicația mobilă, integrări).

import { prisma, quoteStay, round2, touristTax } from "@adonis/database";
import { computeTouristTax, touristTaxRuleFor } from "./fiscal/registry";
import { checkoutReservation } from "./housekeeping";

export async function findConflict(roomId: string, checkIn: Date, checkOut: Date, excludeId?: string) {
  return prisma.reservation.findFirst({
    where: { roomId, status: { notIn: ["cancelled", "no_show"] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    include: { guest: true },
  });
}

export async function quoteFor(roomId: string, checkIn: Date, checkOut: Date, adults: number) {
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { roomType: true, property: true } });
  const [seasons, dailyRates, rule] = await Promise.all([
    prisma.seasonRule.findMany({ where: { propertyId: room.propertyId } }),
    prisma.dailyRate.findMany({ where: { roomTypeId: room.roomTypeId, date: { gte: checkIn, lt: checkOut } } }),
    touristTaxRuleFor(room.property.city, checkIn),
  ]);
  const q = quoteStay({ checkIn, checkOut, roomTypeId: room.roomTypeId, baseRate: room.roomType.baseRate, seasons, dailyRates });
  // regula pe localitate are prioritate; altfel, setarea proprietății
  const tax = rule
    ? computeTouristTax(rule, q.total, q.nights.length, adults)
    : touristTax({ mode: room.property.touristTaxMode, value: room.property.touristTaxValue, accommodation: q.total, nights: q.nights.length, adults });
  return { ...q, tax, room };
}

export async function nextReservationCode(year: number) {
  const last = await prisma.reservation.findFirst({ where: { code: { startsWith: `ADN-${year}-` } }, orderBy: { code: "desc" } });
  return `ADN-${year}-${String(last ? Number(last.code.split("-")[2]) + 1 : 1).padStart(4, "0")}`;
}

export type NewReservation = {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children?: number;
  source?: string;
  status?: string;
  totalAmount?: number; // preț negociat; altfel calculat
  advance?: number;
  paymentMethod?: string;
  voucherType?: string | null;
  notes?: string | null;
  guest: { firstName: string; lastName: string; phone?: string | null; email?: string | null; city?: string | null };
};

export class ReservationError extends Error {}

export async function createReservation(input: NewReservation) {
  if (input.checkOut <= input.checkIn) throw new ReservationError("Data plecării trebuie să fie după data sosirii.");
  const room = await prisma.room.findUniqueOrThrow({ where: { id: input.roomId }, include: { roomType: true } });
  const people = input.adults + (input.children ?? 0);
  if (people > room.roomType.capacity + room.roomType.extraBeds) {
    throw new ReservationError(`Camera ${room.number} primește cel mult ${room.roomType.capacity} persoane (+${room.roomType.extraBeds} pat suplimentar).`);
  }
  const conflict = await findConflict(input.roomId, input.checkIn, input.checkOut);
  if (conflict) throw new ReservationError(`Camera ${room.number} e deja ocupată de ${conflict.guest.firstName} ${conflict.guest.lastName} (${conflict.code}) în acea perioadă.`);
  if (!input.guest.firstName.trim() || !input.guest.lastName.trim()) throw new ReservationError("Completați numele oaspetelui.");

  const q = await quoteFor(input.roomId, input.checkIn, input.checkOut, input.adults);
  const total = input.totalAmount && input.totalAmount > 0 ? input.totalAmount : q.total;
  const { phone, email } = input.guest;
  const or = [phone ? { phone } : null, email ? { email } : null].filter(Boolean) as { phone?: string; email?: string }[];
  const existing = or.length ? await prisma.guest.findFirst({ where: { OR: or } }) : null;
  const guest = existing ?? (await prisma.guest.create({ data: { firstName: input.guest.firstName.trim(), lastName: input.guest.lastName.trim(), phone, email, city: input.guest.city } }));
  const source = input.source ?? "direct";
  const channel = await prisma.channel.findFirst({ where: { kind: source } });
  const advance = input.advance ?? 0;

  const res = await prisma.reservation.create({
    data: {
      code: await nextReservationCode(input.checkIn.getUTCFullYear()),
      roomId: input.roomId, guestId: guest.id, channelId: channel?.id, source, status: input.status ?? "confirmed",
      checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, children: input.children ?? 0, totalAmount: total,
      touristTax: total === q.total ? q.tax : round2((q.tax / (q.total || 1)) * total),
      paidAmount: advance, voucherType: input.voucherType ?? null, notes: input.notes ?? null,
    },
  });
  if (advance > 0) await prisma.payment.create({ data: { reservationId: res.id, amount: advance, method: input.paymentMethod ?? "transfer", kind: "advance" } });
  return res;
}

export async function setStatus(id: string, status: string) {
  if (status === "checked_out") return checkoutReservation(id);
  return prisma.reservation.update({
    where: { id },
    data: { status, ...(status === "cancelled" ? { cancelledAt: new Date() } : {}), ...(status === "checked_in" ? { checkinDoneAt: new Date() } : {}) },
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { quoteStay, touristTax, round2, nightsBetween } from "@adonis/database";
import { parseDay } from "./format";
import { syncChannel } from "./ical";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(String(f.get(k) ?? "0").replace(",", ".")) || 0;
const opt = (f: FormData, k: string) => str(f, k) || null;

async function findConflict(roomId: string, checkIn: Date, checkOut: Date, excludeId?: string) {
  return prisma.reservation.findFirst({
    where: {
      roomId,
      status: { notIn: ["cancelled", "no_show"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    include: { guest: true },
  });
}

export async function quoteFor(roomId: string, checkIn: Date, checkOut: Date, adults: number) {
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { roomType: true, property: true } });
  const [seasons, dailyRates] = await Promise.all([
    prisma.seasonRule.findMany({ where: { propertyId: room.propertyId } }),
    prisma.dailyRate.findMany({ where: { roomTypeId: room.roomTypeId, date: { gte: checkIn, lt: checkOut } } }),
  ]);
  const q = quoteStay({ checkIn, checkOut, roomTypeId: room.roomTypeId, baseRate: room.roomType.baseRate, seasons, dailyRates });
  const tax = touristTax({ mode: room.property.touristTaxMode, value: room.property.touristTaxValue, accommodation: q.total, nights: q.nights.length, adults });
  return { ...q, tax };
}

export type FormState = { error?: string } | undefined;

// ───────────── Rezervări ─────────────

export async function createReservation(_: FormState, f: FormData): Promise<FormState> {
  const roomId = str(f, "roomId");
  const checkIn = parseDay(str(f, "checkIn"));
  const checkOut = parseDay(str(f, "checkOut"));
  const adults = Math.max(1, num(f, "adults"));
  const children = num(f, "children");
  if (!roomId || isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return { error: "Alegeți camera și datele sejurului." };
  if (checkOut <= checkIn) return { error: "Data plecării trebuie să fie după data sosirii." };
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { roomType: true } });
  if (adults + children > room.roomType.capacity + room.roomType.extraBeds)
    return { error: `Camera ${room.number} primește cel mult ${room.roomType.capacity} persoane (+${room.roomType.extraBeds} pat suplimentar).` };
  const conflict = await findConflict(roomId, checkIn, checkOut);
  if (conflict) return { error: `Camera ${room.number} e deja ocupată de ${conflict.guest.firstName} ${conflict.guest.lastName} (${conflict.code}) în acea perioadă.` };

  const firstName = str(f, "firstName");
  const lastName = str(f, "lastName");
  if (!firstName || !lastName) return { error: "Completați numele oaspetelui." };

  const q = await quoteFor(roomId, checkIn, checkOut, adults);
  const manual = num(f, "totalAmount");
  const total = manual > 0 ? manual : q.total;
  const phone = opt(f, "phone");
  const email = opt(f, "email");
  const existing = phone || email ? await prisma.guest.findFirst({ where: { OR: [phone ? { phone } : {}, email ? { email } : {}].filter((x) => Object.keys(x).length) } }) : null;
  const guest = existing ?? (await prisma.guest.create({ data: { firstName, lastName, phone, email, city: opt(f, "city") } }));

  const year = checkIn.getUTCFullYear();
  const last = await prisma.reservation.findFirst({ where: { code: { startsWith: `ADN-${year}-` } }, orderBy: { code: "desc" } });
  const next = last ? Number(last.code.split("-")[2]) + 1 : 1;
  const source = str(f, "source") || "direct";
  const channel = await prisma.channel.findFirst({ where: { kind: source } });
  const advance = num(f, "advance");

  const res = await prisma.reservation.create({
    data: {
      code: `ADN-${year}-${String(next).padStart(4, "0")}`,
      roomId, guestId: guest.id, channelId: channel?.id, source,
      status: str(f, "status") || "confirmed",
      checkIn, checkOut, adults, children, totalAmount: total,
      touristTax: total === q.total ? q.tax : round2((q.tax / (q.total || 1)) * total),
      paidAmount: advance, voucherType: opt(f, "voucherType"), notes: opt(f, "notes"),
    },
  });
  if (advance > 0) await prisma.payment.create({ data: { reservationId: res.id, amount: advance, method: str(f, "paymentMethod") || "transfer", kind: "advance" } });
  revalidatePath("/", "layout");
  redirect(`/rezervari/${res.id}?nou=1`);
}

export async function updateReservation(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const res = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  const roomId = str(f, "roomId") || res.roomId;
  const checkIn = parseDay(str(f, "checkIn"));
  const checkOut = parseDay(str(f, "checkOut"));
  if (checkOut <= checkIn) return { error: "Data plecării trebuie să fie după data sosirii." };
  const conflict = await findConflict(roomId, checkIn, checkOut, id);
  if (conflict) return { error: `Camera e ocupată de ${conflict.guest.firstName} ${conflict.guest.lastName} (${conflict.code}) în acele zile.` };
  const adults = Math.max(1, num(f, "adults"));
  let total = num(f, "totalAmount");
  let tax = res.touristTax;
  if (f.get("requote") === "on" || total <= 0) {
    const q = await quoteFor(roomId, checkIn, checkOut, adults);
    total = q.total;
    tax = q.tax;
  }
  await prisma.reservation.update({
    where: { id },
    data: { roomId, checkIn, checkOut, adults, children: num(f, "children"), totalAmount: total, touristTax: tax, notes: opt(f, "notes"), voucherType: opt(f, "voucherType") },
  });
  revalidatePath("/", "layout");
  return {};
}

export async function setReservationStatus(id: string, status: string) {
  const res = await prisma.reservation.update({
    where: { id },
    data: {
      status,
      ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
      ...(status === "checked_in" ? { checkinDoneAt: new Date() } : {}),
    },
  });
  if (status === "checked_out") {
    await prisma.room.update({ where: { id: res.roomId }, data: { housekeeping: "dirty" } });
    await prisma.housekeepingTask.create({ data: { roomId: res.roomId, reservationId: id, type: "checkout_clean", priority: "high", dueDate: new Date(), status: "todo" } });
  }
  revalidatePath("/", "layout");
}

export async function addPayment(f: FormData) {
  const id = str(f, "reservationId");
  const amount = num(f, "amount");
  if (amount === 0) return;
  const kind = amount < 0 ? "refund" : str(f, "kind") || "advance";
  await prisma.payment.create({ data: { reservationId: id, amount, method: str(f, "method") || "cash", kind, reference: opt(f, "reference") } });
  await prisma.reservation.update({ where: { id }, data: { paidAmount: { increment: amount } } });
  revalidatePath(`/rezervari/${id}`);
}

export async function issueInvoice(reservationId: string) {
  const res = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { guest: true, room: { include: { property: true } }, purchases: { include: { offer: true } } } });
  const p = res.room.property;
  const vat = p.vatRate;
  const net = (gross: number) => round2(gross / (1 + vat / 100));
  const lines = [
    { description: `Cazare camera ${res.room.number}, ${nightsBetween(res.checkIn, res.checkOut)} nopți (${res.code})`, qty: 1, unitPrice: net(res.totalAmount), vatRate: vat },
    ...res.purchases.filter((x) => x.status !== "cancelled").map((x) => ({ description: x.offer.title, qty: x.quantity, unitPrice: net(x.amount), vatRate: vat })),
  ];
  const gross = res.totalAmount + res.purchases.filter((x) => x.status !== "cancelled").reduce((s, x) => s + x.amount * x.quantity, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const inv = await prisma.invoice.create({
    data: {
      series: p.invoiceSeries, number: p.nextInvoiceNo, reservationId, guestId: res.guestId,
      buyerName: `${res.guest.firstName} ${res.guest.lastName}`, lines: JSON.stringify(lines),
      subtotal, vatAmount: round2(gross - subtotal), touristTax: res.touristTax, total: round2(gross + res.touristTax),
      status: res.paidAmount >= gross + res.touristTax ? "paid" : "issued",
    },
  });
  await prisma.property.update({ where: { id: p.id }, data: { nextInvoiceNo: { increment: 1 } } });
  revalidatePath("/", "layout");
  return inv.id;
}

export async function addUpsellToReservation(f: FormData) {
  const reservationId = str(f, "reservationId");
  const offer = await prisma.upsellOffer.findUniqueOrThrow({ where: { id: str(f, "offerId") } });
  const res = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  const qty = Math.max(1, num(f, "quantity") || (offer.unit === "per_night" ? nightsBetween(res.checkIn, res.checkOut) : offer.unit === "per_person" ? res.adults : 1));
  await prisma.upsellPurchase.create({ data: { offerId: offer.id, reservationId, quantity: qty, amount: offer.price, status: "pending" } });
  revalidatePath(`/rezervari/${reservationId}`);
}

export async function setPurchaseStatus(id: string, status: string) {
  const p = await prisma.upsellPurchase.update({ where: { id }, data: { status } });
  revalidatePath(`/rezervari/${p.reservationId}`);
  revalidatePath("/oferte");
}

// ───────────── Oaspeți ─────────────

export async function updateGuest(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const tags = str(f, "tags").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
  await prisma.guest.update({
    where: { id },
    data: {
      firstName: str(f, "firstName"), lastName: str(f, "lastName"), phone: opt(f, "phone"), email: opt(f, "email"),
      city: opt(f, "city"), country: str(f, "country") || "RO", idDocType: opt(f, "idDocType"), idDocNumber: opt(f, "idDocNumber"),
      allergies: opt(f, "allergies"), preferences: opt(f, "preferences"), notes: opt(f, "notes"),
      tags: JSON.stringify(tags), marketingOk: f.get("marketingOk") === "on",
    },
  });
  revalidatePath(`/oaspeti/${id}`);
  return {};
}

// ───────────── Camere & curățenie ─────────────

export async function setRoomHousekeeping(roomId: string, status: string) {
  await prisma.room.update({ where: { id: roomId }, data: { housekeeping: status } });
  revalidatePath("/", "layout");
}

export async function updateRoom(f: FormData) {
  await prisma.room.update({ where: { id: str(f, "id") }, data: { notes: opt(f, "notes"), housekeeping: str(f, "housekeeping") } });
  revalidatePath("/camere");
}

export async function createTask(f: FormData) {
  await prisma.housekeepingTask.create({
    data: {
      roomId: str(f, "roomId"), type: str(f, "type"), priority: str(f, "priority") || "normal",
      assignee: opt(f, "assignee"), dueDate: parseDay(str(f, "dueDate")), notes: opt(f, "notes"),
    },
  });
  revalidatePath("/curatenie");
}

export async function advanceTask(id: string, status: string) {
  const task = await prisma.housekeepingTask.update({
    where: { id },
    data: { status, ...(status === "in_progress" ? { startedAt: new Date() } : {}), ...(status === "done" ? { completedAt: new Date() } : {}) },
  });
  // Curățenia gata → camera trece la verificare; verificarea → pregătită
  if (status === "done" && ["checkout_clean", "stay_clean", "linen_change"].includes(task.type))
    await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "inspect" } });
  if (status === "verified" || (status === "done" && task.type === "inspection"))
    await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "clean" } });
  if (status === "done" && task.type === "maintenance") await prisma.room.update({ where: { id: task.roomId }, data: { housekeeping: "inspect" } });
  revalidatePath("/", "layout");
}

// ───────────── Canale ─────────────

export async function saveChannelLink(f: FormData) {
  await prisma.channelRoomLink.update({ where: { id: str(f, "id") }, data: { importUrl: opt(f, "importUrl") } });
  revalidatePath("/canale");
}

export async function updateChannel(f: FormData) {
  await prisma.channel.update({
    where: { id: str(f, "id") },
    data: { syncIntervalMin: num(f, "syncIntervalMin") || 15, commissionPct: num(f, "commissionPct"), active: f.get("active") === "on" },
  });
  revalidatePath("/canale");
}

export async function runSync(channelId: string) {
  const r = await syncChannel(channelId);
  revalidatePath("/", "layout");
  return r;
}

// ───────────── Mesaje ─────────────

export async function saveTemplate(data: { id?: string; name: string; trigger: string; tone: string; body: string; active: boolean }) {
  const t = data.id
    ? await prisma.messageTemplate.update({ where: { id: data.id }, data: { name: data.name, trigger: data.trigger, tone: data.tone, body: data.body, active: data.active } })
    : await prisma.messageTemplate.create({ data: { name: data.name, trigger: data.trigger, tone: data.tone, body: data.body, active: data.active } });
  revalidatePath("/mesaje");
  return t.id;
}

export async function deleteTemplate(id: string) {
  await prisma.messageTemplate.delete({ where: { id } });
  revalidatePath("/mesaje");
}

// ───────────── Oferte ─────────────

export async function createOffer(f: FormData) {
  const months = str(f, "months").split(",").map((m) => Number(m.trim())).filter((m) => m >= 1 && m <= 12);
  await prisma.upsellOffer.create({
    data: {
      title: str(f, "title"), description: str(f, "description"), category: str(f, "category"), price: num(f, "price"),
      unit: str(f, "unit") || "per_stay", seasonalRules: JSON.stringify(months.length ? { months } : {}),
    },
  });
  revalidatePath("/oferte");
}

export async function toggleOffer(id: string, active: boolean) {
  await prisma.upsellOffer.update({ where: { id }, data: { active } });
  revalidatePath("/oferte");
}

// ───────────── Tarife ─────────────

export async function updateBaseRate(f: FormData) {
  await prisma.roomType.update({ where: { id: str(f, "id") }, data: { baseRate: num(f, "baseRate") } });
  revalidatePath("/tarife");
}

export async function createSeason(f: FormData) {
  const property = await prisma.property.findFirstOrThrow();
  await prisma.seasonRule.create({
    data: {
      propertyId: property.id, name: str(f, "name"), startDate: parseDay(str(f, "startDate")), endDate: parseDay(str(f, "endDate")),
      multiplier: num(f, "multiplier") || 1, minStay: Math.max(1, num(f, "minStay")), priority: num(f, "priority"), roomTypeId: opt(f, "roomTypeId"),
    },
  });
  revalidatePath("/tarife");
}

export async function deleteSeason(id: string) {
  await prisma.seasonRule.delete({ where: { id } });
  revalidatePath("/tarife");
}

// ───────────── Setări ─────────────

export async function updateProperty(_: FormState, f: FormData): Promise<FormState> {
  const p = await prisma.property.findFirstOrThrow();
  await prisma.property.update({
    where: { id: p.id },
    data: {
      name: str(f, "name"), legalName: opt(f, "legalName"), cui: opt(f, "cui"), regCom: opt(f, "regCom"),
      address: str(f, "address"), city: str(f, "city"), county: str(f, "county"), phone: opt(f, "phone"), email: opt(f, "email"),
      checkInTime: str(f, "checkInTime"), checkOutTime: str(f, "checkOutTime"), vatRate: num(f, "vatRate"),
      touristTaxMode: str(f, "touristTaxMode"), touristTaxValue: num(f, "touristTaxValue"), invoiceSeries: str(f, "invoiceSeries"),
      wifiName: opt(f, "wifiName"), wifiPassword: opt(f, "wifiPassword"),
    },
  });
  revalidatePath("/", "layout");
  return {};
}

/** Ofertă de preț pentru formularul de rezervare (apelată din client). */
export async function quote(roomId: string, checkIn: string, checkOut: string, adults: number) {
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!roomId || isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return null;
  const q = await quoteFor(roomId, a, b, adults);
  const conflict = await findConflict(roomId, a, b);
  return {
    total: q.total,
    tax: q.tax,
    nights: q.nights.length,
    minStay: q.minStay,
    minStayOk: q.minStayOk,
    seasons: Array.from(new Set(q.nights.map((n) => n.season ?? "Extrasezon"))),
    conflict: conflict ? `${conflict.guest.firstName} ${conflict.guest.lastName} (${conflict.code})` : null,
  };
}

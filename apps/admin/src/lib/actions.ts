"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { nightsBetween, round2 } from "@adonis/database";
import {
  ReservationError, adjustStock, advanceTask as advanceTaskCore, createPaymentLink, createReservation as createReservationCore, findConflict, quoteFor,
  refreshAlerts, sendInvoiceToSmartBill, sendWhatsApp, setStatus, syncChannel,
} from "@adonis/core";
import { SESSION_COOKIE, SESSION_TTL_H, signSession, type Role } from "@adonis/core/auth";
import { hashPassword, verifyPassword } from "@adonis/core/password";
import { parseDay } from "./format";
import { requireSession } from "./session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(String(f.get(k) ?? "0").replace(",", ".")) || 0;
const opt = (f: FormData, k: string) => str(f, k) || null;

export type FormState = { error?: string } | undefined;

// ───────────── Autentificare ─────────────

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(str(f, "password"), user.passwordHash))) return { error: "E-mail sau parolă greșite." };
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  cookies().set(SESSION_COOKIE, await signSession({ uid: user.id, name: user.name, role: user.role as Role }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_H * 3600,
  });
  const next = str(f, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : user.role === "housekeeping" || user.role === "maintenance" ? "/curatenie" : "/");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

// ───────────── Rezervări ─────────────

export async function createReservation(_: FormState, f: FormData): Promise<FormState> {
  await requireSession();
  const checkIn = parseDay(str(f, "checkIn"));
  const checkOut = parseDay(str(f, "checkOut"));
  if (!str(f, "roomId") || isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return { error: "Alegeți camera și datele sejurului." };
  let id: string;
  try {
    const res = await createReservationCore({
      roomId: str(f, "roomId"), checkIn, checkOut, adults: Math.max(1, num(f, "adults")), children: num(f, "children"),
      source: str(f, "source") || "direct", status: str(f, "status") || "confirmed", totalAmount: num(f, "totalAmount") || undefined,
      advance: num(f, "advance"), paymentMethod: str(f, "paymentMethod") || "transfer", voucherType: opt(f, "voucherType"), notes: opt(f, "notes"),
      guest: { firstName: str(f, "firstName"), lastName: str(f, "lastName"), phone: opt(f, "phone"), email: opt(f, "email"), city: opt(f, "city") },
    });
    id = res.id;
  } catch (e) {
    if (e instanceof ReservationError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/rezervari/${id}?nou=1`);
}

export async function updateReservation(_: FormState, f: FormData): Promise<FormState> {
  await requireSession();
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
  await requireSession();
  await setStatus(id, status);
  revalidatePath("/", "layout");
}

export async function addPayment(f: FormData) {
  await requireSession();
  const id = str(f, "reservationId");
  const amount = num(f, "amount");
  if (amount === 0) return;
  const kind = amount < 0 ? "refund" : str(f, "kind") || "advance";
  await prisma.payment.create({ data: { reservationId: id, amount, method: str(f, "method") || "cash", kind, reference: opt(f, "reference") } });
  await prisma.reservation.update({ where: { id }, data: { paidAmount: { increment: amount } } });
  revalidatePath(`/rezervari/${id}`);
}

export async function createBalanceLink(reservationId: string) {
  await requireSession();
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { purchases: true } });
  const extras = r.purchases.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.amount * p.quantity, 0);
  const due = round2(r.totalAmount + r.touristTax + extras - r.paidAmount);
  if (due <= 0) return;
  await createPaymentLink({ reservationId, amount: due, purpose: "balance", description: `Hostel Adonis · rezervarea ${r.code}` });
  revalidatePath(`/rezervari/${reservationId}`);
}

export async function issueInvoice(reservationId: string) {
  await requireSession();
  const res = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { guest: true, room: { include: { property: true } }, purchases: { include: { offer: true } } } });
  const p = res.room.property;
  const vat = p.vatRate;
  const net = (gross: number) => round2(gross / (1 + vat / 100));
  const extras = res.purchases.filter((x) => x.status !== "cancelled");
  const lines = [
    { description: `Cazare camera ${res.room.number}, ${nightsBetween(res.checkIn, res.checkOut)} nopți (${res.code})`, qty: 1, unitPrice: net(res.totalAmount), vatRate: vat },
    ...extras.map((x) => ({ description: x.offer.title, qty: x.quantity, unitPrice: net(x.amount), vatRate: vat })),
  ];
  const gross = res.totalAmount + extras.reduce((s, x) => s + x.amount * x.quantity, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  await prisma.invoice.create({
    data: {
      series: p.invoiceSeries, number: p.nextInvoiceNo, reservationId, guestId: res.guestId, buyerName: `${res.guest.firstName} ${res.guest.lastName}`,
      lines: JSON.stringify(lines), subtotal, vatAmount: round2(gross - subtotal), touristTax: res.touristTax, total: round2(gross + res.touristTax),
      status: res.paidAmount >= gross + res.touristTax ? "paid" : "issued",
    },
  });
  await prisma.property.update({ where: { id: p.id }, data: { nextInvoiceNo: { increment: 1 } } });
  revalidatePath("/", "layout");
}

export async function pushToSmartBill(invoiceId: string): Promise<FormState> {
  await requireSession(["owner", "manager"]);
  try {
    await sendInvoiceToSmartBill(invoiceId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/facturi");
  return {};
}

export async function addUpsellToReservation(f: FormData) {
  await requireSession();
  const reservationId = str(f, "reservationId");
  const offer = await prisma.upsellOffer.findUniqueOrThrow({ where: { id: str(f, "offerId") } });
  const res = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  const qty = Math.max(1, num(f, "quantity") || (offer.unit === "per_night" ? nightsBetween(res.checkIn, res.checkOut) : offer.unit === "per_person" ? res.adults : 1));
  await prisma.upsellPurchase.create({ data: { offerId: offer.id, reservationId, quantity: qty, amount: offer.price, status: "pending" } });
  revalidatePath(`/rezervari/${reservationId}`);
}

export async function setPurchaseStatus(id: string, status: string) {
  await requireSession();
  const p = await prisma.upsellPurchase.update({ where: { id }, data: { status } });
  if (status === "paid") await prisma.upsellEvent.create({ data: { offerId: p.offerId, reservationId: p.reservationId, kind: "purchase" } });
  revalidatePath(`/rezervari/${p.reservationId}`);
  revalidatePath("/oferte");
}

export async function sendTemplateMessage(reservationId: string, text: string) {
  await requireSession();
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { guest: true } });
  if (!r.guest.phone) return { error: "Oaspetele nu are telefon." };
  const out = await sendWhatsApp({ guestId: r.guestId, phone: r.guest.phone, text });
  return out.sent ? { sent: true } : { link: out.link };
}

// ───────────── Oaspeți ─────────────

export async function updateGuest(_: FormState, f: FormData): Promise<FormState> {
  await requireSession();
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

// ───────────── Camere, curățenie, consumabile ─────────────

export async function setRoomHousekeeping(roomId: string, status: string) {
  await requireSession();
  await prisma.room.update({ where: { id: roomId }, data: { housekeeping: status } });
  revalidatePath("/", "layout");
}

export async function createTask(f: FormData) {
  await requireSession();
  await prisma.housekeepingTask.create({
    data: {
      roomId: str(f, "roomId"), type: str(f, "type"), priority: str(f, "priority") || "normal", assigneeId: opt(f, "assigneeId"),
      assignee: opt(f, "assigneeName"), dueDate: parseDay(str(f, "dueDate")), notes: opt(f, "notes"),
    },
  });
  revalidatePath("/curatenie");
}

export async function advanceTask(id: string, status: string) {
  const s = await requireSession();
  await advanceTaskCore(id, status, s.uid);
  revalidatePath("/", "layout");
}

export async function adjustInventory(f: FormData) {
  const s = await requireSession();
  const q = num(f, "quantity");
  if (q !== 0) await adjustStock(str(f, "itemId"), q, str(f, "reason") || "restock", s.uid);
  revalidatePath("/consumabile");
}

// ───────────── Canale ─────────────

export async function saveChannelLink(f: FormData) {
  await requireSession(["owner", "manager", "reception"]);
  await prisma.channelRoomLink.update({ where: { id: str(f, "id") }, data: { importUrl: opt(f, "importUrl") } });
  revalidatePath("/canale");
}

export async function updateChannel(f: FormData) {
  await requireSession(["owner", "manager"]);
  await prisma.channel.update({
    where: { id: str(f, "id") },
    data: { syncIntervalMin: num(f, "syncIntervalMin") || 15, commissionPct: num(f, "commissionPct"), active: f.get("active") === "on" },
  });
  revalidatePath("/canale");
}

export async function runSync(channelId: string) {
  await requireSession();
  const r = await syncChannel(channelId);
  await refreshAlerts();
  revalidatePath("/", "layout");
  return r;
}

// ───────────── Mesaje ─────────────

export async function saveTemplate(data: { id?: string; name: string; trigger: string; tone: string; body: string; active: boolean }) {
  await requireSession();
  const fields = { name: data.name, trigger: data.trigger, tone: data.tone, body: data.body, active: data.active };
  const t = data.id ? await prisma.messageTemplate.update({ where: { id: data.id }, data: fields }) : await prisma.messageTemplate.create({ data: fields });
  revalidatePath("/mesaje");
  return t.id;
}

export async function deleteTemplate(id: string) {
  await requireSession();
  await prisma.messageTemplate.delete({ where: { id } });
  revalidatePath("/mesaje");
}

// ───────────── Oferte ─────────────

export async function createOffer(f: FormData) {
  await requireSession(["owner", "manager", "reception"]);
  const months = str(f, "months").split(",").map((m) => Number(m.trim())).filter((m) => m >= 1 && m <= 12);
  const rules: Record<string, unknown> = {};
  if (months.length) rules.months = months;
  if (num(f, "minNights")) rules.minNights = num(f, "minNights");
  if (num(f, "maxDaysBeforeArrival")) rules.maxDaysBeforeArrival = num(f, "maxDaysBeforeArrival");
  await prisma.upsellOffer.create({
    data: { title: str(f, "title"), description: str(f, "description"), category: str(f, "category"), price: num(f, "price"), unit: str(f, "unit") || "per_stay", seasonalRules: JSON.stringify(rules) },
  });
  revalidatePath("/oferte");
}

export async function toggleOffer(id: string, active: boolean) {
  await requireSession();
  await prisma.upsellOffer.update({ where: { id }, data: { active } });
  revalidatePath("/oferte");
}

// ───────────── Tarife ─────────────

export async function updateBaseRate(f: FormData) {
  await requireSession(["owner", "manager"]);
  await prisma.roomType.update({ where: { id: str(f, "id") }, data: { baseRate: num(f, "baseRate") } });
  revalidatePath("/tarife");
}

export async function createSeason(f: FormData) {
  await requireSession(["owner", "manager"]);
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
  await requireSession(["owner", "manager"]);
  await prisma.seasonRule.delete({ where: { id } });
  revalidatePath("/tarife");
}

// ───────────── Analitice ─────────────

export async function resolveAlert(id: string) {
  await requireSession();
  await prisma.alert.update({ where: { id }, data: { resolvedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function checkAlerts() {
  await requireSession();
  await refreshAlerts();
  revalidatePath("/", "layout");
}

export async function markReviewReplied(id: string) {
  await requireSession();
  await prisma.review.update({ where: { id }, data: { repliedAt: new Date() } });
  revalidatePath("/analitice");
}

// ───────────── Setări & personal ─────────────

export async function updateProperty(_: FormState, f: FormData): Promise<FormState> {
  await requireSession(["owner", "manager"]);
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

export async function createUser(_: FormState, f: FormData): Promise<FormState> {
  await requireSession(["owner"]);
  const email = str(f, "email").toLowerCase();
  const password = str(f, "password");
  if (password.length < 10) return { error: "Parola trebuie să aibă cel puțin 10 caractere." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Există deja un cont cu acest e-mail." };
  await prisma.user.create({ data: { name: str(f, "name"), email, role: str(f, "role"), passwordHash: await hashPassword(password) } });
  revalidatePath("/setari");
  return {};
}

export async function toggleUser(id: string, active: boolean) {
  const s = await requireSession(["owner"]);
  if (s.uid === id) return;
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/setari");
}

export async function changePassword(_: FormState, f: FormData): Promise<FormState> {
  const s = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: s.uid } });
  if (!(await verifyPassword(str(f, "current"), user.passwordHash))) return { error: "Parola actuală nu e corectă." };
  if (str(f, "next").length < 10) return { error: "Parola nouă trebuie să aibă cel puțin 10 caractere." };
  await prisma.user.update({ where: { id: s.uid }, data: { passwordHash: await hashPassword(str(f, "next")) } });
  return {};
}

/** Ofertă de preț pentru formularul de rezervare (apelată din client). */
export async function quote(roomId: string, checkIn: string, checkOut: string, adults: number) {
  await requireSession();
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!roomId || isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return null;
  const q = await quoteFor(roomId, a, b, adults);
  const conflict = await findConflict(roomId, a, b);
  return {
    total: q.total, tax: q.tax, nights: q.nights.length, minStay: q.minStay, minStayOk: q.minStayOk,
    seasons: Array.from(new Set(q.nights.map((n) => n.season ?? "Extrasezon"))),
    conflict: conflict ? `${conflict.guest.firstName} ${conflict.guest.lastName} (${conflict.code})` : null,
  };
}

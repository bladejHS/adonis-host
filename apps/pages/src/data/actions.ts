// Operațiile aplicației, rulate în browser. Regulile (tarife, reguli oferte, validări, UBL, CSV)
// sunt aceleași funcții din @adonis/core/pure folosite și de server.

import { nightsBetween, quoteStay, round2, startOfDay, touristTax, DAY_MS } from "@adonis/database/pricing";
import { isEligible, isValidCnp, isValidDocNumber, birthDateFromCnp, quantityFor, parseIcsText, computeTouristTax } from "@adonis/core/pure";
import { getDb, kvSet, mutate, uid } from "./store";
import type { Db, HousekeepingTask, Reservation } from "./types";

export const today = () => startOfDay(new Date());
export const CONTRACT_VERSION = "2026-10";

const ACTIVE = (r: Reservation) => !["cancelled", "no_show"].includes(r.status);

// ── Rezervări ──

export function findConflict(db: Db, roomId: string, checkIn: Date, checkOut: Date, excludeId?: string) {
  const r = db.reservations.find((x) => x.roomId === roomId && ACTIVE(x) && x.checkIn < checkOut && x.checkOut > checkIn && x.id !== excludeId);
  return r ? { ...r, guest: db.guests.find((g) => g.id === r.guestId)! } : null;
}

export function quote(db: Db, roomId: string, checkIn: Date, checkOut: Date, adults: number) {
  const room = db.rooms.find((r) => r.id === roomId)!;
  const type = db.roomTypes.find((t) => t.id === room.roomTypeId)!;
  const q = quoteStay({ checkIn, checkOut, roomTypeId: type.id, baseRate: type.baseRate, seasons: db.seasons });
  const p = db.property;
  const tax = touristTax({ mode: p.touristTaxMode, value: p.touristTaxValue, accommodation: q.total, nights: q.nights.length, adults });
  return { ...q, tax, room, type };
}

function nextCode(db: Db, year: number) {
  const nums = db.reservations.filter((r) => r.code.startsWith(`ADN-${year}-`)).map((r) => Number(r.code.split("-")[2]));
  return `ADN-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
}

export type NewReservation = {
  roomId: string; checkIn: Date; checkOut: Date; adults: number; children: number; source: string; status: string;
  totalAmount?: number; advance: number; paymentMethod: string; voucherType: string | null; notes: string | null;
  guest: { firstName: string; lastName: string; phone: string | null; email: string | null; city: string | null };
};

export function createReservation(input: NewReservation): { id?: string; error?: string } {
  const db = getDb();
  if (!(input.checkOut > input.checkIn)) return { error: "Data plecării trebuie să fie după data sosirii." };
  const room = db.rooms.find((r) => r.id === input.roomId);
  if (!room) return { error: "Alegeți camera." };
  const type = db.roomTypes.find((t) => t.id === room.roomTypeId)!;
  if (input.adults + input.children > type.capacity + type.extraBeds) return { error: `Camera ${room.number} primește cel mult ${type.capacity} persoane (+${type.extraBeds} pat suplimentar).` };
  const c = findConflict(db, input.roomId, input.checkIn, input.checkOut);
  if (c) return { error: `Camera ${room.number} e deja ocupată de ${c.guest.firstName} ${c.guest.lastName} (${c.code}) în acea perioadă.` };
  if (!input.guest.firstName.trim() || !input.guest.lastName.trim()) return { error: "Completați numele oaspetelui." };
  const q = quote(db, input.roomId, input.checkIn, input.checkOut, input.adults);
  const total = input.totalAmount && input.totalAmount > 0 ? input.totalAmount : q.total;
  return mutate((db) => {
    const now = new Date();
    let guest = db.guests.find((g) => (input.guest.phone && g.phone === input.guest.phone) || (input.guest.email && g.email === input.guest.email));
    if (!guest) {
      guest = {
        id: uid(), firstName: input.guest.firstName.trim(), lastName: input.guest.lastName.trim(), email: input.guest.email, phone: input.guest.phone,
        country: "RO", city: input.guest.city, idDocType: null, idDocNumber: null, cnp: null, birthDate: null, tags: "[]", allergies: null,
        preferences: null, notes: null, marketingOk: false, createdAt: now,
      };
      db.guests.push(guest);
    }
    const id = uid();
    db.reservations.push({
      id, code: nextCode(db, input.checkIn.getUTCFullYear()), roomId: input.roomId, guestId: guest.id,
      channelId: db.channels.find((ch) => ch.kind === input.source)?.id ?? null, source: input.source, status: input.status,
      checkIn: input.checkIn, checkOut: input.checkOut, adults: input.adults, children: input.children, totalAmount: total,
      touristTax: total === q.total ? q.tax : round2((q.tax / (q.total || 1)) * total), paidAmount: input.advance, currency: "RON",
      voucherType: input.voucherType, notes: input.notes, externalUid: null, externalBookingId: null, lastSyncedAt: null,
      checkinToken: uid(), checkinDoneAt: null, createdAt: now, updatedAt: now, cancelledAt: null,
    });
    if (input.advance > 0) db.payments.push({ id: uid(), reservationId: id, amount: input.advance, method: input.paymentMethod, kind: "advance", paidAt: now, reference: null });
    return { id };
  });
}

export function updateReservation(id: string, f: { roomId: string; checkIn: Date; checkOut: Date; adults: number; children: number; totalAmount: number; requote: boolean; notes: string | null; voucherType: string | null }): string | null {
  const db = getDb();
  if (!(f.checkOut > f.checkIn)) return "Data plecării trebuie să fie după data sosirii.";
  const c = findConflict(db, f.roomId, f.checkIn, f.checkOut, id);
  if (c) return `Camera e ocupată de ${c.guest.firstName} ${c.guest.lastName} (${c.code}) în acele zile.`;
  mutate((db) => {
    const r = db.reservations.find((x) => x.id === id)!;
    let total = f.totalAmount;
    let tax = r.touristTax;
    if (f.requote || total <= 0) {
      const q = quote(db, f.roomId, f.checkIn, f.checkOut, f.adults);
      total = q.total;
      tax = q.tax;
    }
    Object.assign(r, { roomId: f.roomId, checkIn: f.checkIn, checkOut: f.checkOut, adults: f.adults, children: f.children, totalAmount: total, touristTax: tax, notes: f.notes, voucherType: f.voucherType, updatedAt: new Date() });
  });
  return null;
}

function newTask(roomId: string, type: string, extra: Partial<HousekeepingTask> = {}): HousekeepingTask {
  return {
    id: uid(), roomId, reservationId: null, type, status: "todo", priority: "normal", assignee: null, dueDate: today(), startedAt: null,
    completedAt: null, photoUrl: null, notes: null, assigneeId: null, minutesSpent: null, createdAt: new Date(), ...extra,
  };
}

export function setStatus(id: string, status: string) {
  mutate((db) => {
    const r = db.reservations.find((x) => x.id === id)!;
    r.status = status;
    if (status === "cancelled") r.cancelledAt = new Date();
    if (status === "checked_in") r.checkinDoneAt ??= new Date();
    if (status === "checked_out") {
      db.rooms.find((x) => x.id === r.roomId)!.housekeeping = "dirty";
      db.tasks.push(newTask(r.roomId, "checkout_clean", { reservationId: id, priority: "high" }));
    }
  });
}

export function addPayment(reservationId: string, amount: number, method: string, reference: string | null) {
  if (!amount) return;
  mutate((db) => {
    db.payments.push({ id: uid(), reservationId, amount, method, kind: amount < 0 ? "refund" : "advance", paidAt: new Date(), reference });
    db.reservations.find((r) => r.id === reservationId)!.paidAmount += amount;
  });
}

export function balanceOf(db: Db, r: Reservation) {
  const extras = db.purchases.filter((p) => p.reservationId === r.id && p.status !== "cancelled").reduce((s, p) => s + p.amount * p.quantity, 0);
  return { extras, grand: r.totalAmount + r.touristTax + extras, due: round2(r.totalAmount + r.touristTax + extras - r.paidAmount) };
}

export function createPaymentLink(reservationId: string, amount: number, purpose: string, purchaseIds: string[] = []) {
  return mutate((db) => {
    const link = { id: uid(), reservationId, purpose, amount: round2(amount), status: "created", createdAt: new Date(), paidAt: null, purchaseIds };
    db.paymentLinks.push(link);
    return link.id;
  });
}

/** Plata demo: aceleași efecte ca webhook-ul Stripe pe server. */
export function payLink(linkId: string) {
  mutate((db) => {
    const l = db.paymentLinks.find((x) => x.id === linkId);
    if (!l || l.status === "paid") return;
    l.status = "paid";
    l.paidAt = new Date();
    db.payments.push({ id: uid(), reservationId: l.reservationId, amount: l.amount, method: "online", kind: l.purpose === "balance" ? "final" : "advance", paidAt: new Date(), reference: `demo:${l.id}` });
    db.reservations.find((r) => r.id === l.reservationId)!.paidAmount += l.amount;
    for (const p of db.purchases.filter((x) => l.purchaseIds.includes(x.id))) {
      p.status = "paid";
      db.upsellEvents.push({ offerId: p.offerId, kind: "purchase", reservationId: l.reservationId });
    }
  });
}

export function issueInvoice(reservationId: string) {
  mutate((db) => {
    const r = db.reservations.find((x) => x.id === reservationId)!;
    const guest = db.guests.find((g) => g.id === r.guestId)!;
    const room = db.rooms.find((x) => x.id === r.roomId)!;
    const p = db.property;
    const net = (gross: number) => round2(gross / (1 + p.vatRate / 100));
    const extras = db.purchases.filter((x) => x.reservationId === r.id && x.status !== "cancelled");
    const lines = [
      { description: `Cazare camera ${room.number}, ${nightsBetween(r.checkIn, r.checkOut)} nopți (${r.code})`, qty: 1, unitPrice: net(r.totalAmount), vatRate: p.vatRate },
      ...extras.map((x) => ({ description: db.offers.find((o) => o.id === x.offerId)!.title, qty: x.quantity, unitPrice: net(x.amount), vatRate: p.vatRate })),
    ];
    const gross = r.totalAmount + extras.reduce((s, x) => s + x.amount * x.quantity, 0);
    const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
    db.invoices.push({
      id: uid(), series: p.invoiceSeries, number: p.nextInvoiceNo, reservationId: r.id, guestId: guest.id, buyerName: `${guest.firstName} ${guest.lastName}`,
      buyerCui: null, buyerAddress: null, issueDate: new Date(), lines: JSON.stringify(lines), subtotal, vatAmount: round2(gross - subtotal),
      touristTax: r.touristTax, total: round2(gross + r.touristTax), status: r.paidAmount >= gross + r.touristTax ? "paid" : "issued",
      efacturaStatus: "not_sent", efacturaId: null, smartbillId: null,
    });
    p.nextInvoiceNo++;
  });
}

export function addPurchase(reservationId: string, offerId: string, qty?: number) {
  mutate((db) => {
    const r = db.reservations.find((x) => x.id === reservationId)!;
    const o = db.offers.find((x) => x.id === offerId)!;
    db.purchases.push({ id: uid(), offerId, reservationId, quantity: qty || quantityFor(o.unit, r), amount: o.price, status: "pending", createdAt: new Date(), paymentLinkId: null });
  });
}

export function setPurchaseStatus(id: string, status: string) {
  mutate((db) => {
    const p = db.purchases.find((x) => x.id === id)!;
    p.status = status;
    if (status === "paid") db.upsellEvents.push({ offerId: p.offerId, kind: "purchase", reservationId: p.reservationId });
  });
}

// ── Camere, curățenie, consumabile ──

export function setRoomHk(roomId: string, status: string) {
  mutate((db) => void (db.rooms.find((r) => r.id === roomId)!.housekeeping = status));
}

export function createTask(t: { roomId: string; type: string; priority: string; assigneeId: string | null; dueDate: Date; notes: string | null }) {
  mutate((db) => void db.tasks.push(newTask(t.roomId, t.type, { priority: t.priority, assigneeId: t.assigneeId, dueDate: t.dueDate, notes: t.notes })));
}

const CLEANING = ["checkout_clean", "stay_clean", "linen_change"];

export function advanceTask(id: string, status: string, userId?: string) {
  mutate((db) => {
    const t = db.tasks.find((x) => x.id === id)!;
    const now = new Date();
    t.status = status;
    if (status === "in_progress") {
      t.startedAt = now;
      if (userId) t.assigneeId ??= userId;
    }
    if (status === "done") {
      t.completedAt = now;
      t.minutesSpent = t.startedAt ? Math.max(1, Math.round((now.getTime() - t.startedAt.getTime()) / 60000)) : null;
    }
    const room = db.rooms.find((r) => r.id === t.roomId)!;
    if (status === "done" && CLEANING.includes(t.type)) {
      room.housekeeping = "inspect";
      if (t.type === "checkout_clean") {
        for (const it of db.inventory.filter((i) => i.perCheckout > 0)) {
          it.stock = round2(it.stock - it.perCheckout);
          db.movements.push({ id: uid(), itemId: it.id, quantity: -it.perCheckout, reason: "checkout_clean", taskId: id, userId: userId ?? null, createdAt: now });
        }
      }
    }
    if (status === "verified" || (status === "done" && t.type === "inspection")) room.housekeeping = "clean";
    if (status === "done" && t.type === "maintenance") {
      room.housekeeping = "inspect";
      room.notes = null;
    }
  });
}

export function adjustStock(itemId: string, quantity: number, reason: string, userId?: string) {
  if (!quantity) return;
  mutate((db) => {
    const it = db.inventory.find((i) => i.id === itemId)!;
    it.stock = round2(it.stock + quantity);
    db.movements.push({ id: uid(), itemId, quantity, reason, taskId: null, userId: userId ?? null, createdAt: new Date() });
  });
}

// ── Canale: import manual de calendar iCal (fișier .ics descărcat din Booking/Airbnb) ──

export function importIcs(channelId: string, roomId: string, text: string) {
  const events = parseIcsText(text);
  return mutate((db) => {
    const channel = db.channels.find((c) => c.id === channelId)!;
    const room = db.rooms.find((r) => r.id === roomId)!;
    const t = today();
    const stats = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };
    const details: string[] = [];
    const existing = db.reservations.filter((r) => r.channelId === channelId && r.roomId === roomId && r.externalUid);
    const seen = new Set<string>();
    for (const ev of events) {
      if (ev.end <= t) continue;
      seen.add(ev.uid);
      const match = existing.find((r) => r.externalUid === ev.uid);
      const overlap = db.reservations.find((r) => r.roomId === roomId && ACTIVE(r) && r.checkIn < ev.end && r.checkOut > ev.start && r.id !== match?.id && r.externalUid !== ev.uid);
      if (overlap) {
        stats.conflicts++;
        details.push(`Camera ${room.number}: ${ev.summary || "rezervare"} se suprapune cu ${overlap.code}`);
      }
      if (match) {
        if (match.checkIn.getTime() !== ev.start.getTime() || match.checkOut.getTime() !== ev.end.getTime() || match.status === "cancelled") {
          Object.assign(match, { checkIn: ev.start, checkOut: ev.end, status: match.status === "cancelled" ? "confirmed" : match.status, lastSyncedAt: new Date() });
          stats.updated++;
        }
        continue;
      }
      const guest = { id: uid(), firstName: "Oaspete", lastName: channel.name, email: null, phone: null, country: "RO", city: null, idDocType: null, idDocNumber: null, cnp: null, birthDate: null, tags: "[]", allergies: null, preferences: null, notes: "Creat automat din iCal.", marketingOk: false, createdAt: new Date() };
      db.guests.push(guest);
      db.reservations.push({
        id: uid(), code: nextCode(db, ev.start.getUTCFullYear()), roomId, guestId: guest.id, channelId, source: channel.kind === "airbnb" ? "airbnb" : "booking",
        status: "confirmed", checkIn: ev.start, checkOut: ev.end, adults: 2, children: 0, totalAmount: 0, touristTax: 0, paidAmount: 0, currency: "RON",
        voucherType: null, notes: [ev.summary, overlap ? `⚠ Suprapunere cu ${overlap.code}` : null].filter(Boolean).join(" · ") || null,
        externalUid: ev.uid, externalBookingId: null, lastSyncedAt: new Date(), checkinToken: uid(), checkinDoneAt: null, createdAt: new Date(), updatedAt: new Date(), cancelledAt: null,
      });
      stats.created++;
    }
    const future = existing.filter((r) => r.checkIn >= t && r.status !== "cancelled");
    if (!(events.length === 0 && future.length > 0)) {
      for (const r of future.filter((r) => !seen.has(r.externalUid!))) {
        r.status = "cancelled";
        r.cancelledAt = new Date();
        stats.cancelled++;
      }
    }
    const message = `Import camera ${room.number}: ${stats.created} noi, ${stats.updated} modificate, ${stats.cancelled} anulate${stats.conflicts ? `, ${stats.conflicts} suprapuneri` : ""}.`;
    db.syncLogs.push({ id: uid(), channelId, type: "ical", direction: "import", status: "ok", startedAt: new Date(), finishedAt: new Date(), ...stats, message, details: JSON.stringify(details) });
    channel.lastSyncAt = new Date();
    channel.lastSyncStatus = "ok";
    for (const d of details) raise(db, "overbooking", "critical", `Suprapunere pe ${channel.name}`, d, "/calendar");
    return { ...stats, events: events.length };
  });
}

// ── Mesaje, oferte, tarife, setări ──

export function saveTemplate(t: { id?: string; name: string; trigger: string; tone: string; body: string; active: boolean }) {
  return mutate((db) => {
    const existing = t.id ? db.templates.find((x) => x.id === t.id) : undefined;
    if (existing) {
      Object.assign(existing, { ...t, updatedAt: new Date() });
      return existing.id;
    }
    const id = uid();
    db.templates.push({ id, name: t.name, trigger: t.trigger, tone: t.tone, body: t.body, active: t.active, language: "ro", updatedAt: new Date() });
    return id;
  });
}

export function deleteTemplate(id: string) {
  mutate((db) => void (db.templates = db.templates.filter((t) => t.id !== id)));
}

export function createOffer(o: { title: string; description: string; category: string; price: number; unit: string; months: number[] }) {
  mutate((db) => {
    db.offers.push({ id: uid(), title: o.title, description: o.description, category: o.category, price: o.price, unit: o.unit, seasonalRules: JSON.stringify(o.months.length ? { months: o.months } : {}), imagePath: null, active: true, sortOrder: db.offers.length });
  });
}

export const toggleOffer = (id: string) => mutate((db) => void (db.offers.find((o) => o.id === id)!.active = !db.offers.find((o) => o.id === id)!.active));
export const updateBaseRate = (id: string, rate: number) => mutate((db) => void (db.roomTypes.find((t) => t.id === id)!.baseRate = rate));
export const deleteSeason = (id: string) => mutate((db) => void (db.seasons = db.seasons.filter((s) => s.id !== id)));
export function createSeason(s: { name: string; startDate: Date; endDate: Date; multiplier: number; minStay: number; priority: number; roomTypeId: string | null }) {
  mutate((db) => void db.seasons.push({ id: uid(), propertyId: db.property.id, color: "#c6a15b", ...s }));
}
export const updateProperty = (patch: Partial<Db["property"]>) => mutate((db) => void Object.assign(db.property, patch, { updatedAt: new Date() }));
export function updateGuest(id: string, patch: Partial<Db["guests"][number]>) {
  mutate((db) => void Object.assign(db.guests.find((g) => g.id === id)!, patch));
}

// ── Alerte ──

function raise(db: Db, kind: string, severity: string, title: string, body: string, link: string) {
  if (db.alerts.some((a) => a.kind === kind && a.title === title && a.body === body && !a.resolvedAt)) return;
  db.alerts.push({ id: uid(), kind, severity, title, body, link, createdAt: new Date(), resolvedAt: null });
}

export function refreshAlerts() {
  mutate((db) => {
    const now = Date.now();
    const SRC: Record<string, string> = { booking: "Booking.com", airbnb: "Airbnb", google: "Google", direct: "site" };
    for (const r of db.reviews.filter((x) => x.rating < 6 && !x.repliedAt && x.createdAt.getTime() > now - 30 * DAY_MS)) {
      raise(db, "negative_review", "critical", `Recenzie ${r.rating.toFixed(1)}/10 pe ${SRC[r.source] ?? r.source} de la ${r.author ?? "un oaspete"}`, (r.comment ?? "").slice(0, 280), "/analitice");
    }
    for (const it of db.inventory.filter((i) => i.stock <= i.minStock)) raise(db, "low_stock", "warning", `Stoc mic: ${it.name}`, `Au rămas ${it.stock} ${it.unit} (minim ${it.minStock}).`, "/consumabile");
    const d14 = now - 14 * DAY_MS;
    const recent = db.reservations.filter((r) => r.createdAt.getTime() >= d14).length;
    const lastYear = db.reservations.filter((r) => r.createdAt.getTime() >= d14 - 365 * DAY_MS && r.createdAt.getTime() < now - 365 * DAY_MS).length;
    if (lastYear >= 5 && recent < lastYear * 0.7) {
      raise(db, "booking_pace_drop", "warning", `Rezervările au scăzut cu ${Math.round((1 - recent / lastYear) * 100)}% față de anul trecut`, `${recent} rezervări noi în ultimele 14 zile, față de ${lastYear} anul trecut.`, "/rapoarte");
    }
  });
}

export const resolveAlert = (id: string) => mutate((db) => void (db.alerts.find((a) => a.id === id)!.resolvedAt = new Date()));
export const markReplied = (id: string) => mutate((db) => void (db.reviews.find((r) => r.id === id)!.repliedAt = new Date()));

// ── Oaspeți: check-in online și oferte ──

export function byToken(db: Db, token: string) {
  const r = db.reservations.find((x) => x.checkinToken === token);
  if (!r) return null;
  const room = db.rooms.find((x) => x.id === r.roomId)!;
  return { r, guest: db.guests.find((g) => g.id === r.guestId)!, room, type: db.roomTypes.find((t) => t.id === room.roomTypeId)!, checkin: db.checkins.find((c) => c.reservationId === r.id) };
}

export function tokenState(r: Reservation) {
  if (["cancelled", "no_show"].includes(r.status)) return "cancelled";
  if (Date.now() > r.checkOut.getTime() + DAY_MS) return "expired";
  if (r.checkinDoneAt) return "done";
  return "open";
}

export type CheckinForm = {
  firstName: string; lastName: string; email: string; phone: string; country: string; city: string; idDocType: "CI" | "pasaport"; idDocNumber: string;
  cnp: string; birthDate: string; arrivalTime: string; consentGdpr: boolean; consentMarketing: boolean; consentWhatsapp: boolean; idImage: string; signature: string;
};

export async function submitCheckin(token: string, f: CheckinForm): Promise<{ field: string; message: string } | null> {
  const t = byToken(getDb(), token);
  if (!t) return { field: "token", message: "Linkul nu este valid." };
  if (tokenState(t.r) !== "open") return { field: "token", message: "Check-in-ul nu mai poate fi completat de aici." };
  if (!isValidDocNumber(f.idDocType, f.idDocNumber)) return { field: "idDocNumber", message: "Seria și numărul actului par greșite." };
  if (f.country === "RO" && f.idDocType === "CI" && !isValidCnp(f.cnp)) return { field: "cnp", message: "CNP-ul nu este valid." };
  if (!f.consentGdpr) return { field: "consentGdpr", message: "Avem nevoie de acordul pentru prelucrarea datelor." };
  const imageKey = `img:${uid()}`;
  const signatureKey = `img:${uid()}`;
  await kvSet(imageKey, f.idImage);
  await kvSet(signatureKey, f.signature);
  mutate((db) => {
    const g = db.guests.find((x) => x.id === t.guest.id)!;
    Object.assign(g, {
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email || g.email, phone: f.phone || g.phone, country: f.country, city: f.city || g.city,
      idDocType: f.idDocType, idDocNumber: f.idDocNumber.replace(/\s/g, "").toUpperCase(), cnp: f.cnp || null,
      birthDate: f.cnp && isValidCnp(f.cnp) ? birthDateFromCnp(f.cnp) : f.birthDate ? new Date(f.birthDate + "T00:00:00Z") : null, marketingOk: f.consentMarketing,
    });
    db.checkins.push({ reservationId: t.r.id, idDocType: f.idDocType, idDocNumber: g.idDocNumber!, imageKey, signatureKey, contractVersion: CONTRACT_VERSION, arrivalTime: f.arrivalTime, signedAt: new Date() });
    db.reservations.find((x) => x.id === t.r.id)!.checkinDoneAt = new Date();
    for (const [kind, granted] of [["gdpr_processing", true], ["id_scan", true], ["marketing", f.consentMarketing], ["whatsapp", f.consentWhatsapp]] as const) {
      db.consents.push({ guestId: g.id, kind, granted, source: "checkin_form", createdAt: new Date() });
    }
  });
  return null;
}

export function offersFor(db: Db, reservationId: string) {
  const r = db.reservations.find((x) => x.id === reservationId)!;
  const room = db.rooms.find((x) => x.id === r.roomId)!;
  const code = db.roomTypes.find((t) => t.id === room.roomTypeId)!.code;
  const bought = new Set(db.purchases.filter((p) => p.reservationId === r.id && p.status !== "cancelled").map((p) => p.offerId));
  return db.offers
    .filter((o) => isEligible(o, { checkIn: r.checkIn, checkOut: r.checkOut, adults: r.adults, roomTypeCode: code }))
    .map((o) => ({ ...o, quantity: quantityFor(o.unit, r), total: o.price * quantityFor(o.unit, r), bought: bought.has(o.id) }));
}

export function trackViews(reservationId: string, offerIds: string[]) {
  mutate((db) => offerIds.forEach((offerId) => db.upsellEvents.push({ offerId, kind: "view", reservationId })));
}

export function buyOffers(reservationId: string, offerIds: string[]) {
  const offers = offersFor(getDb(), reservationId).filter((o) => offerIds.includes(o.id) && !o.bought);
  if (!offers.length) return null;
  const ids = mutate((db) =>
    offers.map((o) => {
      db.upsellEvents.push({ offerId: o.id, kind: "click", reservationId });
      const p = { id: uid(), offerId: o.id, reservationId, quantity: o.quantity, amount: o.price, status: "pending", createdAt: new Date(), paymentLinkId: null };
      db.purchases.push(p);
      return p.id;
    }),
  );
  return createPaymentLink(reservationId, offers.reduce((s, o) => s + o.total, 0), "upsell", ids);
}

export function touristTaxForProperty(db: Db, accommodation: number, nights: number, adults: number) {
  return computeTouristTax({ mode: db.property.touristTaxMode, value: db.property.touristTaxValue }, accommodation, nights, adults);
}

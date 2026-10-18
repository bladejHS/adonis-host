import ical from "node-ical";
import { prisma, startOfDay } from "@adonis/database";
import { bookingXmlAdapter } from "./booking-xml";


/**
 * Sincronizare iCal (Booking.com, Airbnb). Fiecare cameră are un feed per canal.
 * - eveniment nou       → rezervare nouă (oaspete provizoriu, completat la sosire)
 * - date schimbate      → rezervarea se actualizează
 * - dispărut din feed   → rezervarea viitoare se anulează
 * - suprapunere cu altă rezervare pe aceeași cameră → conflict, notat în jurnal și pe rezervare
 *
 * Interfața ChannelSync permite adăugarea ulterioară a Booking.com XML fără a schimba apelanții.
 */

export type ParsedEvent = { uid: string; start: Date; end: Date; summary: string };

/** Sursa de rezervări a unui canal. `ref` = URL-ul iCal sau, pentru XML, id-ul camerei la canal. */
export interface ChannelSync {
  fetchEvents(ref: string): Promise<ParsedEvent[]>;
}

export function parseIcs(text: string): ParsedEvent[] {
  const data = ical.sync.parseICS(text);
  const out: ParsedEvent[] = [];
  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as ical.VEvent;
    if (!ev.start || !ev.end) continue;
    const toDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Evenimentele de tip "dată" vin ca miezul nopții local; le normalizăm la zi UTC
    const start = (ev.start as Date & { dateOnly?: boolean }).dateOnly ? toDay(ev.start) : startOfDay(ev.start);
    const end = (ev.end as Date & { dateOnly?: boolean }).dateOnly ? toDay(ev.end) : startOfDay(ev.end);
    if (end <= start) continue;
    const summary = typeof ev.summary === "string" ? ev.summary : (ev.summary as { val?: string } | undefined)?.val ?? "";
    out.push({ uid: String(ev.uid ?? `${start.toISOString()}-${end.toISOString()}`), start, end, summary });
  }
  return out;
}

export const icalSync: ChannelSync = {
  async fetchEvents(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "AdonisHost/1.0 (+https://www.casaadonis.ro)" }, cache: "no-store" });
      if (!res.ok) throw new Error(`răspuns ${res.status}`);
      return parseIcs(await res.text());
    } finally {
      clearTimeout(timer);
    }
  },
};

export async function syncChannel(channelId: string, adapter?: ChannelSync) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId }, include: { roomLinks: { include: { room: true } } } });
  const xml = channel.syncType === "xml";
  const source_ = adapter ?? (xml ? bookingXmlAdapter() : icalSync);
  const refOf = (l: (typeof channel.roomLinks)[number]) => (xml ? l.externalRoomId : l.importUrl);
  const links = channel.roomLinks.filter((l) => refOf(l));
  const log = await prisma.channelSyncLog.create({ data: { channelId, type: xml ? "xml" : "ical", status: "partial" } });
  const stats = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };
  const errors: string[] = [];
  const details: string[] = [];
  const today = startOfDay(new Date());
  const source = channel.kind === "airbnb" ? "airbnb" : channel.kind === "booking" ? "booking" : "other";

  if (links.length === 0) {
    await prisma.channelSyncLog.update({
      where: { id: log.id },
      data: { status: "error", finishedAt: new Date(), message: "Nicio cameră nu are încă linkul iCal al canalului. Adăugați-l mai jos, la fiecare cameră." },
    });
    await prisma.channel.update({ where: { id: channelId }, data: { lastSyncAt: new Date(), lastSyncStatus: "error" } });
    return { ...stats, errors: ["Niciun link iCal configurat"] };
  }

  for (const link of links) {
    let events: ParsedEvent[];
    try {
      events = await source_.fetchEvents(refOf(link)!);
    } catch (e) {
      errors.push(`Camera ${link.room.number}: ${(e as Error).message}`);
      continue;
    }
    const existing = await prisma.reservation.findMany({ where: { channelId, roomId: link.roomId, externalUid: { not: null } } });
    const seen = new Set<string>();

    for (const ev of events) {
      if (ev.end <= today) continue; // trecutul nu se mai modifică
      seen.add(ev.uid);
      const match = existing.find((r) => r.externalUid === ev.uid);
      const overlapping = await prisma.reservation.findFirst({
        where: {
          roomId: link.roomId,
          status: { notIn: ["cancelled", "no_show"] },
          checkIn: { lt: ev.end },
          checkOut: { gt: ev.start },
          // atenție: NOT pe externalUid ar exclude rândurile cu NULL (rezervările directe)
          ...(match ? { NOT: { id: match.id } } : {}),
        },
      });
      if (overlapping) {
        stats.conflicts++;
        details.push(`Camera ${link.room.number}: ${ev.summary || "rezervare"} se suprapune cu ${overlapping.code}`);
      }
      if (match) {
        if (match.checkIn.getTime() !== ev.start.getTime() || match.checkOut.getTime() !== ev.end.getTime() || match.status === "cancelled") {
          await prisma.reservation.update({
            where: { id: match.id },
            data: { checkIn: ev.start, checkOut: ev.end, status: match.status === "cancelled" ? "confirmed" : match.status, lastSyncedAt: new Date() },
          });
          stats.updated++;
        }
        continue;
      }
      const guest = await prisma.guest.create({ data: { firstName: "Oaspete", lastName: channel.name, notes: "Creat automat din iCal. Completați datele la sosire." } });
      const year = ev.start.getUTCFullYear();
      const count = await prisma.reservation.count({ where: { code: { startsWith: `ADN-${year}-` } } });
      await prisma.reservation.create({
        data: {
          code: `ADN-${year}-${String(count + 1).padStart(4, "0")}`,
          roomId: link.roomId, guestId: guest.id, channelId, source, status: "confirmed",
          checkIn: ev.start, checkOut: ev.end, externalUid: ev.uid, lastSyncedAt: new Date(),
          notes: [ev.summary, overlapping ? `⚠ Suprapunere cu ${overlapping.code}` : null].filter(Boolean).join(" · ") || null,
        },
      });
      stats.created++;
    }

    // Un feed gol, când aveam rezervări viitoare, înseamnă de obicei o problemă la canal, nu anulări în masă
    const futureExisting = existing.filter((r) => r.checkIn >= today && r.status !== "cancelled");
    if (events.length === 0 && futureExisting.length > 0) {
      errors.push(`Camera ${link.room.number}: feed-ul a venit gol, am păstrat cele ${futureExisting.length} rezervări existente`);
      continue;
    }
    for (const r of futureExisting) {
      if (!seen.has(r.externalUid!)) {
        await prisma.reservation.update({ where: { id: r.id }, data: { status: "cancelled", cancelledAt: new Date(), lastSyncedAt: new Date() } });
        stats.cancelled++;
      }
    }
  }

  const status = errors.length === 0 ? "ok" : errors.length === links.length ? "error" : "partial";
  const message =
    status === "ok"
      ? `Sincronizare reușită: ${stats.created} noi, ${stats.updated} modificate, ${stats.cancelled} anulate${stats.conflicts ? `, ${stats.conflicts} suprapuneri` : ""}.`
      : `${errors.length} din ${links.length} feed-uri nu au răspuns. Reîncercăm la următoarea sincronizare.`;
  await prisma.channelSyncLog.update({
    where: { id: log.id },
    data: { status, finishedAt: new Date(), ...stats, message, details: JSON.stringify({ errors, conflicts: details }) },
  });
  await prisma.channel.update({ where: { id: channelId }, data: { lastSyncAt: new Date(), lastSyncStatus: status } });
  if (details.length) {
    // o singură alertă deschisă per conflict, chiar dacă sincronizarea rulează din 15 în 15 minute
    for (const d of details) {
      const open = await prisma.alert.findFirst({ where: { kind: "overbooking", body: d, resolvedAt: null } });
      if (!open) await prisma.alert.create({ data: { kind: "overbooking", severity: "critical", title: `Suprapunere pe ${channel.name}`, body: d, link: "/calendar" } });
    }
  }
  return { ...stats, errors };
}

/** Feed iCal exportat pentru o cameră — Booking/Airbnb îl citesc ca să blocheze datele vândute direct. */
export async function exportRoomCalendar(token: string) {
  const room = await prisma.room.findUnique({ where: { icalExportToken: token } });
  if (!room) return null;
  const [reservations, overrides] = await Promise.all([
    prisma.reservation.findMany({ where: { roomId: room.id, status: { notIn: ["cancelled", "no_show"] }, checkOut: { gte: startOfDay(new Date()) } } }),
    prisma.availabilityOverride.findMany({ where: { roomId: room.id, endDate: { gte: startOfDay(new Date()) } } }),
  ]);
  const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hostel Adonis Costinesti//Adonis Host//RO", "CALSCALE:GREGORIAN", `X-WR-CALNAME:Adonis camera ${room.number}`];
  for (const r of reservations) {
    lines.push("BEGIN:VEVENT", `UID:${r.id}@adonis-host`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(r.checkIn)}`, `DTEND;VALUE=DATE:${day(r.checkOut)}`, "SUMMARY:Ocupat - Adonis", "END:VEVENT");
  }
  for (const o of overrides) {
    lines.push("BEGIN:VEVENT", `UID:${o.id}@adonis-host`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(o.startDate)}`, `DTEND;VALUE=DATE:${day(o.endDate)}`, "SUMMARY:Indisponibil", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return { room, body: lines.join("\r\n") + "\r\n" };
}

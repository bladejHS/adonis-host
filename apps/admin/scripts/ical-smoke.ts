// Test rapid al sincronizării iCal pe baza locală, fără rețea.
// Rulare: pnpm --filter @adonis/admin exec tsx scripts/ical-smoke.ts
import { prisma } from "@adonis/database";
import { parseIcs, syncChannel, type ChannelSync } from "../src/lib/ical";

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};
const ics = (events: [string, number, number][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Booking.com//EN",
    ...events.flatMap(([uid, a, b]) => ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART;VALUE=DATE:${day(a)}`, `DTEND;VALUE=DATE:${day(b)}`, "SUMMARY:CLOSED - Not available", "END:VEVENT"]),
    "END:VCALENDAR"].join("\r\n");

async function main() {
  const parsed = parseIcs(ics([["a@booking", 10, 12]]));
  console.assert(parsed.length === 1 && parsed[0].uid === "a@booking", "parsare");
  console.log("parse:", parsed.map((e) => `${e.uid} ${e.start.toISOString().slice(0, 10)} → ${e.end.toISOString().slice(0, 10)}`));

  const booking = await prisma.channel.findFirstOrThrow({ where: { kind: "booking" } });
  const room = await prisma.room.findUniqueOrThrow({ where: { number: "36" } });
  const link = await prisma.channelRoomLink.findUniqueOrThrow({ where: { channelId_roomId: { channelId: booking.id, roomId: room.id } } });
  await prisma.channelRoomLink.update({ where: { id: link.id }, data: { importUrl: "memory://camera-36" } });

  // smoke-2 și smoke-3 se suprapun → un conflict
  let feed = ics([["smoke-1@booking", 10, 12], ["smoke-2@booking", 6, 8], ["smoke-3@booking", 7, 9]]);
  const adapter: ChannelSync = { fetchEvents: async () => parseIcs(feed) };

  const r1 = await syncChannel(booking.id, adapter);
  console.log("sync 1:", r1);
  const r2 = await syncChannel(booking.id, adapter);
  console.log("sync 2 (idempotent):", r2);
  feed = ics([["smoke-1@booking", 11, 13], ["smoke-2@booking", 6, 8]]);
  const r3 = await syncChannel(booking.id, adapter);
  console.log("sync 3 (mutare + anulare):", r3);

  // curățenie
  const created = await prisma.reservation.findMany({ where: { externalUid: { startsWith: "smoke-" } } });
  await prisma.reservation.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
  await prisma.guest.deleteMany({ where: { id: { in: created.map((c) => c.guestId) } } });
  await prisma.channelRoomLink.update({ where: { id: link.id }, data: { importUrl: null } });
  await prisma.channelSyncLog.deleteMany({ where: { startedAt: { gte: new Date(Date.now() - 60_000) } } });
  const ok = r1.created === 3 && r1.cancelled === 0 && r1.conflicts >= 1 && r2.created === 0 && r2.updated === 0 && r3.updated === 1 && r3.cancelled === 1;
  console.log(ok ? "✓ sincronizarea iCal funcționează" : "✗ rezultat neașteptat");
  process.exit(ok ? 0 : 1);
}
main();

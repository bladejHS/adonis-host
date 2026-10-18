import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@adonis/database";
import { parseIcs, syncChannel, exportRoomCalendar, type ChannelSync } from "../src/sync/ical";
import { seedMinimal } from "./helpers";

const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");
const memory = (text: () => string): ChannelSync => ({ fetchEvents: async () => parseIcs(text()) });

describe("parser iCal", () => {
  it("citește exportul Booking.com", () => {
    const ev = parseIcs(fixture("booking-camera-21.ics"));
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ uid: "4f1a2b3c4d5e@booking.com", summary: "CLOSED - Not available" });
    expect(ev[0].start.toISOString().slice(0, 10)).toBe("2027-07-12");
    expect(ev[0].end.toISOString().slice(0, 10)).toBe("2027-07-17");
  });

  it("citește exportul Airbnb, inclusiv zilele blocate", () => {
    const ev = parseIcs(fixture("airbnb-camera-21.ics"));
    expect(ev.map((e) => e.summary)).toEqual(["Reserved", "Airbnb (Not available)"]);
  });

  it("ignoră evenimentele fără durată", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20270101\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcs(ics)).toHaveLength(0);
  });
});

describe("sincronizare canal", () => {
  let ctx: Awaited<ReturnType<typeof seedMinimal>>;
  beforeEach(async () => {
    ctx = await seedMinimal();
  });

  it("creează rezervări noi și e idempotentă", async () => {
    const adapter = memory(() => fixture("booking-camera-21.ics"));
    const first = await syncChannel(ctx.booking.id, adapter);
    expect(first).toMatchObject({ created: 2, updated: 0, cancelled: 0, conflicts: 0 });
    const second = await syncChannel(ctx.booking.id, adapter);
    expect(second).toMatchObject({ created: 0, updated: 0, cancelled: 0 });
    const res = await prisma.reservation.findMany({ where: { roomId: ctx.r21.id } });
    expect(res.every((r) => r.source === "booking" && r.code.startsWith("ADN-2027-"))).toBe(true);
  });

  it("mută rezervarea când se schimbă datele și o anulează când dispare din feed", async () => {
    let feed = fixture("booking-camera-21.ics");
    const adapter = memory(() => feed);
    await syncChannel(ctx.booking.id, adapter);
    feed = feed.replace("DTSTART;VALUE=DATE:20270712", "DTSTART;VALUE=DATE:20270713").replace(/BEGIN:VEVENT\r?\nUID:9a8b7c6d5e4f[\s\S]*?END:VEVENT\r?\n/, "");
    const r = await syncChannel(ctx.booking.id, adapter);
    expect(r).toMatchObject({ updated: 1, cancelled: 1 });
    const moved = await prisma.reservation.findFirstOrThrow({ where: { externalUid: "4f1a2b3c4d5e@booking.com" } });
    expect(moved.checkIn.toISOString().slice(0, 10)).toBe("2027-07-13");
  });

  it("nu anulează nimic când feed-ul vine gol (problemă la canal)", async () => {
    let feed = fixture("booking-camera-21.ics");
    const adapter = memory(() => feed);
    await syncChannel(ctx.booking.id, adapter);
    feed = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
    const r = await syncChannel(ctx.booking.id, adapter);
    expect(r.cancelled).toBe(0);
    expect(r.errors[0]).toContain("feed-ul a venit gol");
    expect(await prisma.reservation.count({ where: { status: "cancelled" } })).toBe(0);
  });

  it("detectează suprapunerea cu o rezervare directă și ridică alertă", async () => {
    const guest = await prisma.guest.create({ data: { firstName: "Ion", lastName: "Direct" } });
    await prisma.reservation.create({
      data: { code: "ADN-2027-0099", roomId: ctx.r21.id, guestId: guest.id, source: "direct", checkIn: new Date("2027-07-14T00:00:00Z"), checkOut: new Date("2027-07-16T00:00:00Z") },
    });
    const r = await syncChannel(ctx.booking.id, memory(() => fixture("booking-camera-21.ics")));
    expect(r.conflicts).toBe(1);
    const alert = await prisma.alert.findFirst({ where: { kind: "overbooking" } });
    expect(alert?.body).toContain("ADN-2027-0099");
  });

  it("raportează feed-urile care nu răspund fără să oprească restul", async () => {
    const failing: ChannelSync = {
      fetchEvents: async () => {
        throw new Error("timeout");
      },
    };
    const r = await syncChannel(ctx.booking.id, failing);
    expect(r.errors[0]).toContain("Camera 21: timeout");
    const log = await prisma.channelSyncLog.findFirstOrThrow({ orderBy: { startedAt: "desc" } });
    expect(log.status).toBe("error");
  });

  it("exportă calendarul camerei pentru celelalte canale", async () => {
    await syncChannel(ctx.booking.id, memory(() => fixture("booking-camera-21.ics")));
    const cal = await exportRoomCalendar(ctx.r21.icalExportToken);
    expect(cal?.body).toContain("BEGIN:VCALENDAR");
    expect(cal?.body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(cal?.body).toContain("DTSTART;VALUE=DATE:20270712");
  });
});

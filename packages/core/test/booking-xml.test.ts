import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bookingXmlAdapter, parseOtaHotelResNotif, xmlToEvents } from "../src/sync/booking-xml";

const xml = readFileSync(path.join(__dirname, "fixtures", "ota-hotel-res-notif.xml"), "utf8");

describe("Booking.com XML (pregătire)", () => {
  it("parsează OTA_HotelResNotifRQ", () => {
    const [res, cancelled] = parseOtaHotelResNotif(xml);
    expect(res).toMatchObject({ id: "4105537212", status: "new", hotelId: "8712345", total: 2380, currency: "RON", commission: 357, remarks: "Sosim după ora 20." });
    expect(res.customer).toMatchObject({ firstName: "Elena", lastName: "Marinescu", email: "elena.m@example.com", phone: "+40722000111", countryCode: "RO" });
    expect(res.rooms[0]).toMatchObject({ roomId: "871234501", adults: 2, children: 1, amount: 2380 });
    expect(res.rooms[0].checkIn.toISOString().slice(0, 10)).toBe("2027-07-12");
    expect(cancelled.status).toBe("cancelled");
  });

  it("transformă rezervările în evenimente ca la iCal, fără cele anulate", () => {
    const events = xmlToEvents(parseOtaHotelResNotif(xml), "871234501");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ uid: "4105537212-0@booking-xml", summary: "Elena Marinescu" });
  });

  it("refuză apelurile live cât timp XML nu e activat", async () => {
    await expect(bookingXmlAdapter().fetchEvents("871234501")).rejects.toThrow(/nu e activată/);
  });

  it("respinge mesaje de alt tip", () => {
    expect(() => parseOtaHotelResNotif("<OTA_HotelAvailNotifRQ/>")).toThrow();
  });
});

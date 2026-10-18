import { describe, expect, it } from "vitest";
import { nightsBetween, quoteStay, seasonFor, touristTax } from "@adonis/database";

const d = (s: string) => new Date(s + "T00:00:00Z");
const seasons = [
  { name: "Vârf", roomTypeId: null, startDate: d("2027-07-10"), endDate: d("2027-08-20"), multiplier: 1.7, minStay: 3, priority: 20 },
  { name: "Sfânta Maria (DVM)", roomTypeId: "DVM", startDate: d("2027-08-14"), endDate: d("2027-08-16"), multiplier: 2, minStay: 2, priority: 20 },
  { name: "1 Mai", roomTypeId: null, startDate: d("2027-04-30"), endDate: d("2027-05-03"), multiplier: 1.5, minStay: 2, priority: 30 },
];

describe("tarife pe sezon", () => {
  it("numără nopțile, nu zilele", () => {
    expect(nightsBetween(d("2027-07-12"), d("2027-07-17"))).toBe(5);
  });

  it("aplică multiplicatorul sezonului pe fiecare noapte", () => {
    const q = quoteStay({ checkIn: d("2027-07-08"), checkOut: d("2027-07-12"), roomTypeId: "DVM", baseRate: 280, seasons });
    // 8 și 9 iulie extrasezon (280), 10 și 11 iulie vârf (476)
    expect(q.nights.map((n) => n.rate)).toEqual([280, 280, 476, 476]);
    expect(q.total).toBe(1512);
  });

  it("regula specifică tipului de cameră câștigă la prioritate egală", () => {
    expect(seasonFor(d("2027-08-15"), "DVM", seasons)?.name).toBe("Sfânta Maria (DVM)");
    expect(seasonFor(d("2027-08-15"), "DVL", seasons)?.name).toBe("Vârf");
  });

  it("semnalează minimul de nopți", () => {
    const q = quoteStay({ checkIn: d("2027-07-20"), checkOut: d("2027-07-22"), roomTypeId: "DVM", baseRate: 280, seasons });
    expect(q.minStay).toBe(3);
    expect(q.minStayOk).toBe(false);
  });

  it("tariful zilnic explicit are prioritate", () => {
    const q = quoteStay({ checkIn: d("2027-07-20"), checkOut: d("2027-07-21"), roomTypeId: "DVM", baseRate: 280, seasons, dailyRates: [{ date: d("2027-07-20"), rate: 520 }] });
    expect(q.total).toBe(520);
  });

  it("calculează taxa turistică procentual sau pe persoană și noapte", () => {
    expect(touristTax({ mode: "percent", value: 1, accommodation: 2380, nights: 5, adults: 2 })).toBe(23.8);
    expect(touristTax({ mode: "per_night_person", value: 2, accommodation: 2380, nights: 5, adults: 2 })).toBe(20);
  });
});

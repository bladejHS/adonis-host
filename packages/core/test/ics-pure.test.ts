import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcs } from "../src/sync/ical";
import { buildIcs, parseIcsText } from "../src/pure/ics";

const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");

describe("parser iCal pentru browser", () => {
  it("dă aceleași evenimente ca node-ical pe exporturile Booking și Airbnb", () => {
    for (const f of ["booking-camera-21.ics", "airbnb-camera-21.ics"]) {
      const a = parseIcsText(fixture(f)).map((e) => [e.uid, e.start.toISOString(), e.end.toISOString(), e.summary]);
      const b = parseIcs(fixture(f)).map((e) => [e.uid, e.start.toISOString(), e.end.toISOString(), e.summary]);
      expect(a).toEqual(b);
    }
  });

  it("citește înapoi calendarul exportat", () => {
    const ics = buildIcs("21", [{ uid: "x@adonis", start: new Date("2027-07-12T00:00:00Z"), end: new Date("2027-07-17T00:00:00Z"), summary: "Ocupat - Adonis" }]);
    expect(parseIcsText(ics)).toEqual([{ uid: "x@adonis", start: new Date("2027-07-12T00:00:00Z"), end: new Date("2027-07-17T00:00:00Z"), summary: "Ocupat - Adonis" }]);
  });
});

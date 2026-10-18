import { rmSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@adonis/database";
import { CheckinError, submitCheckin, tokenState } from "../src/checkin";
import { seedMinimal } from "./helpers";

// PNG 1×1 umplut până peste pragul de „semnătură completă”
const png = "data:image/png;base64," + Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(2000, 7)]).toString("base64");
const jpeg = "data:image/jpeg;base64," + Buffer.alloc(5000, 3).toString("base64");

describe("check-in online", () => {
  let token: string;
  beforeEach(async () => {
    const ctx = await seedMinimal();
    const guest = await prisma.guest.create({ data: { firstName: "Oaspete", lastName: "Booking.com" } });
    const r = await prisma.reservation.create({
      data: { code: "ADN-2099-0001", roomId: ctx.r21.id, guestId: guest.id, adults: 2, checkIn: new Date("2099-07-12T00:00:00Z"), checkOut: new Date("2099-07-17T00:00:00Z") },
    });
    token = r.checkinToken;
  });
  afterAll(() => rmSync("./test-storage", { recursive: true, force: true }));

  const input = () => ({
    token, firstName: "Elena", lastName: "Marinescu", country: "RO", idDocType: "CI" as const, idDocNumber: "CT 123456", cnp: "2851104400122",
    idImage: jpeg, signature: png, consentGdpr: true, consentMarketing: false, consentWhatsapp: true,
  });

  it("respinge un CNP invalid cu mesaj pe câmp", async () => {
    await expect(submitCheckin({ ...input(), cnp: "2851104400123" })).rejects.toMatchObject({ field: "cnp" });
  });

  it("cere acordul GDPR și semnătura", async () => {
    await expect(submitCheckin({ ...input(), consentGdpr: false })).rejects.toBeInstanceOf(CheckinError);
    await expect(submitCheckin({ ...input(), signature: "data:image/png;base64,AAAA" })).rejects.toMatchObject({ field: "signature" });
  });

  it("salvează actul, semnătura, acordurile și completează fișa oaspetelui", async () => {
    await submitCheckin(input());
    const r = await prisma.reservation.findUniqueOrThrow({ where: { checkinToken: token }, include: { guest: { include: { consents: true } }, checkin: true } });
    expect(r.checkinDoneAt).not.toBeNull();
    expect(r.checkin).toMatchObject({ idDocType: "CI", idDocNumber: "CT123456" });
    expect(r.checkin!.idImagePath).toMatch(/^checkin\/id\/.+\.jpg$/);
    expect(r.guest).toMatchObject({ firstName: "Elena", lastName: "Marinescu", cnp: "2851104400122" });
    expect(r.guest.birthDate?.toISOString().slice(0, 10)).toBe("1985-11-04");
    expect(r.guest.consents.map((c) => c.kind).sort()).toEqual(["gdpr_processing", "id_scan", "marketing", "whatsapp"]);
    expect(tokenState(r)).toBe("done");
    await expect(submitCheckin(input())).rejects.toThrow(/deja completat/);
  });

  it("linkul expiră după plecare", () => {
    expect(tokenState({ status: "confirmed", checkOut: new Date("2020-01-01T00:00:00Z"), checkinDoneAt: null })).toBe("expired");
    expect(tokenState({ status: "cancelled", checkOut: new Date("2099-01-01T00:00:00Z"), checkinDoneAt: null })).toBe("cancelled");
  });
});

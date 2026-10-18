import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@adonis/database";
import { createPaymentLink, handleStripeWebhook, markPaid, verifyStripeSignature } from "../src/payments";
import { isEligible, quantityFor } from "../src/upsell";
import { seedMinimal } from "./helpers";

const sign = (payload: string, secret: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

describe("semnătura webhook Stripe", () => {
  const secret = "whsec_test_adonis";
  it("acceptă semnătura corectă", () => {
    expect(verifyStripeSignature('{"a":1}', sign('{"a":1}', secret), secret)).toBe(true);
  });
  it("respinge corp modificat, secret greșit sau mesaj vechi", () => {
    expect(verifyStripeSignature('{"a":2}', sign('{"a":1}', secret), secret)).toBe(false);
    expect(verifyStripeSignature('{"a":1}', sign('{"a":1}', "alt"), secret)).toBe(false);
    expect(verifyStripeSignature('{"a":1}', sign('{"a":1}', secret, Math.floor(Date.now() / 1000) - 3600), secret)).toBe(false);
    expect(verifyStripeSignature('{"a":1}', null, secret)).toBe(false);
  });
});

describe("linkuri de plată și conversie", () => {
  let reservationId: string;
  let offerId: string;
  beforeEach(async () => {
    const ctx = await seedMinimal();
    const guest = await prisma.guest.create({ data: { firstName: "Maria", lastName: "Popescu", email: "maria@example.com" } });
    const r = await prisma.reservation.create({
      data: { code: "ADN-2027-0001", roomId: ctx.r21.id, guestId: guest.id, checkIn: new Date("2027-07-12T00:00:00Z"), checkOut: new Date("2027-07-17T00:00:00Z"), totalAmount: 2380, touristTax: 23.8 },
    });
    reservationId = r.id;
    offerId = (await prisma.upsellOffer.create({ data: { title: "Barca la răsărit", description: "-", category: "experience", price: 150, unit: "per_person" } })).id;
  });

  it("fără chei Stripe/Netopia creează un link demo", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NETOPIA_API_KEY;
    const link = await createPaymentLink({ reservationId, amount: 300, purpose: "upsell", description: "Barca la răsărit" });
    expect(link.provider).toBe("demo");
    expect(link.url).toContain(`/plata/demo/${link.id}`);
  });

  it("marcarea plății e idempotentă și actualizează rezervarea, extra și conversia", async () => {
    const purchase = await prisma.upsellPurchase.create({ data: { offerId, reservationId, quantity: 2, amount: 150 } });
    const link = await createPaymentLink({ reservationId, amount: 300, purpose: "upsell", description: "Barca", purchaseIds: [purchase.id] });
    await markPaid(link.id, "test");
    await markPaid(link.id, "test"); // a doua notificare nu dublează încasarea
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { payments: true, purchases: true } });
    expect(r.paidAmount).toBe(300);
    expect(r.payments).toHaveLength(1);
    expect(r.purchases[0].status).toBe("paid");
    expect(await prisma.upsellEvent.count({ where: { kind: "purchase" } })).toBe(1);
  });

  it("webhook-ul Stripe cu semnătură validă confirmă plata", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_adonis";
    const link = await createPaymentLink({ reservationId, amount: 500, purpose: "balance", description: "Rest" });
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_status: "paid", metadata: { paymentLinkId: link.id } } } });
    await handleStripeWebhook(payload, sign(payload, "whsec_test_adonis"));
    expect((await prisma.paymentLink.findUniqueOrThrow({ where: { id: link.id } })).status).toBe("paid");
    await expect(handleStripeWebhook(payload, "t=1,v1=fals")).rejects.toThrow(/invalidă/);
  });
});

describe("reguli oferte extra", () => {
  const offer = (rules: object) => ({ id: "o", category: "experience", price: 150, unit: "per_person", active: true, seasonalRules: JSON.stringify(rules) });
  const stay = { checkIn: new Date("2027-07-12T00:00:00Z"), checkOut: new Date("2027-07-17T00:00:00Z"), adults: 2, roomTypeCode: "DVL" };
  const now = new Date("2027-07-05T10:00:00Z");

  it("filtrează după luna sejurului", () => {
    expect(isEligible(offer({ months: [7, 8] }), stay, now)).toBe(true);
    expect(isEligible(offer({ months: [9] }), stay, now)).toBe(false);
  });
  it("respectă fereastra de rezervare înainte de sosire", () => {
    expect(isEligible(offer({ maxDaysBeforeArrival: 14 }), stay, now)).toBe(true);
    expect(isEligible(offer({ maxDaysBeforeArrival: 3 }), stay, now)).toBe(false);
    expect(isEligible(offer({ minDaysBeforeArrival: 10 }), stay, now)).toBe(false);
  });
  it("ține cont de tipul camerei și de numărul de nopți", () => {
    expect(isEligible(offer({ excludeRoomTypes: ["DVM"] }), stay, now)).toBe(true);
    expect(isEligible(offer({ roomTypes: ["DVM"] }), stay, now)).toBe(false);
    expect(isEligible(offer({ minNights: 7 }), stay, now)).toBe(false);
  });
  it("calculează cantitatea după unitate", () => {
    expect(quantityFor("per_night", stay)).toBe(5);
    expect(quantityFor("per_person", stay)).toBe(2);
    expect(quantityFor("per_stay", stay)).toBe(1);
  });
});

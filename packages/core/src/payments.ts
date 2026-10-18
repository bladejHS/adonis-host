// Linkuri de plată: Stripe Checkout, Netopia (mobilPay v2) și un mod demo pentru dezvoltare.
// Fără SDK-uri: apeluri REST directe, ca dependențele să rămână puține.

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma, round2 } from "@adonis/database";

export type Provider = "stripe" | "netopia" | "demo";

export function availableProvider(preferred?: Provider): Provider {
  if (preferred === "stripe" && process.env.STRIPE_SECRET_KEY) return "stripe";
  if (preferred === "netopia" && process.env.NETOPIA_API_KEY) return "netopia";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  if (process.env.NETOPIA_API_KEY) return "netopia";
  return "demo";
}

const guestBase = () => (process.env.GUEST_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const apiBase = () => (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

type LinkInput = {
  reservationId: string;
  amount: number;
  description: string;
  purpose: "balance" | "upsell" | "advance";
  purchaseIds?: string[];
  provider?: Provider;
};

export async function createPaymentLink(input: LinkInput) {
  if (input.amount <= 0) throw new Error("Suma de plată trebuie să fie mai mare decât zero.");
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId }, include: { guest: true } });
  const provider = availableProvider(input.provider);
  const link = await prisma.paymentLink.create({ data: { reservationId: r.id, provider, purpose: input.purpose, amount: round2(input.amount) } });
  if (input.purchaseIds?.length) await prisma.upsellPurchase.updateMany({ where: { id: { in: input.purchaseIds } }, data: { paymentLinkId: link.id } });

  const successUrl = `${guestBase()}/plata/multumim?link=${link.id}`;
  const cancelUrl = `${guestBase()}/oferte/${r.checkinToken}`;
  let url: string;
  let externalId: string | null = null;

  if (provider === "stripe") {
    const body = new URLSearchParams({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][unit_amount]": String(Math.round(input.amount * 100)),
      "line_items[0][price_data][product_data][name]": input.description,
      "metadata[paymentLinkId]": link.id,
      "metadata[reservationCode]": r.code,
      locale: "ro",
      ...(r.guest.email ? { customer_email: r.guest.email } : {}),
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
    if (!res.ok || !json.url) throw new Error(`Stripe: ${json.error?.message ?? res.status}`);
    url = json.url;
    externalId = json.id ?? null;
  } else if (provider === "netopia") {
    const sandbox = process.env.NETOPIA_SANDBOX !== "false";
    const base = sandbox ? "https://secure.sandbox.netopia-payments.com" : "https://secure.mobilpay.ro/pay";
    const res = await fetch(`${base}/payment/card/start`, {
      method: "POST",
      headers: { Authorization: process.env.NETOPIA_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { emailTemplate: "", notifyUrl: `${apiBase()}/webhooks/netopia`, redirectUrl: successUrl, language: "ro" },
        payment: { options: { installments: 0, bonus: 0 }, instrument: { type: "card" } },
        order: {
          ntpID: "", posSignature: process.env.NETOPIA_POS_SIGNATURE, dateTime: new Date().toISOString(),
          description: input.description, orderID: link.id, amount: round2(input.amount), currency: "RON",
          billing: { email: r.guest.email ?? "rezervari@casaadonis.ro", phone: r.guest.phone ?? "", firstName: r.guest.firstName, lastName: r.guest.lastName, city: r.guest.city ?? "", country: 642, countryName: "Romania", state: "", postalCode: "", details: "" },
        },
      }),
    });
    const json = (await res.json()) as { payment?: { paymentURL?: string; ntpID?: string }; error?: { message?: string } };
    if (!res.ok || !json.payment?.paymentURL) throw new Error(`Netopia: ${json.error?.message ?? res.status}`);
    url = json.payment.paymentURL;
    externalId = json.payment.ntpID ?? null;
  } else {
    url = `${guestBase()}/plata/demo/${link.id}`;
  }

  return prisma.paymentLink.update({ where: { id: link.id }, data: { url, externalId } });
}

/** Marchează un link plătit: încasare pe rezervare, extra plătite, eveniment de conversie. Idempotent. */
export async function markPaid(linkId: string, reference?: string) {
  const link = await prisma.paymentLink.findUnique({ where: { id: linkId }, include: { purchases: true } });
  if (!link || link.status === "paid") return link;
  await prisma.$transaction([
    prisma.paymentLink.update({ where: { id: linkId }, data: { status: "paid", paidAt: new Date() } }),
    prisma.payment.create({ data: { reservationId: link.reservationId, amount: link.amount, method: "online", kind: link.purpose === "balance" ? "final" : "advance", reference: reference ?? `${link.provider}:${link.externalId ?? link.id}` } }),
    prisma.reservation.update({ where: { id: link.reservationId }, data: { paidAmount: { increment: link.amount } } }),
    prisma.upsellPurchase.updateMany({ where: { paymentLinkId: linkId }, data: { status: "paid" } }),
    prisma.upsellEvent.createMany({ data: link.purchases.map((p) => ({ offerId: p.offerId, reservationId: link.reservationId, kind: "purchase" })) }),
  ]);
  return prisma.paymentLink.findUnique({ where: { id: linkId } });
}

/** Verifică semnătura webhook-ului Stripe (header Stripe-Signature: t=…,v1=…). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const given = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return given.some((g) => g.length === expected.length && timingSafeEqual(Buffer.from(g), Buffer.from(expected)));
}

export async function handleStripeWebhook(payload: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !verifyStripeSignature(payload, signature, secret)) throw new Error("Semnătură Stripe invalidă");
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string; metadata?: Record<string, string> } } };
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const id = event.data.object.metadata?.paymentLinkId;
    if (id) await markPaid(id, `stripe:${event.data.object.id}`);
  }
  return { received: true };
}

/** IPN Netopia: nu ne bazăm pe corpul notificării, confirmăm starea direct la Netopia. */
export async function handleNetopiaIpn(body: { payment?: { ntpID?: string }; order?: { orderID?: string } }) {
  const linkId = body.order?.orderID;
  const ntpID = body.payment?.ntpID;
  if (!linkId || !ntpID) throw new Error("Notificare Netopia incompletă");
  const sandbox = process.env.NETOPIA_SANDBOX !== "false";
  const base = sandbox ? "https://secure.sandbox.netopia-payments.com" : "https://secure.mobilpay.ro/pay";
  const res = await fetch(`${base}/operation/status`, {
    method: "POST",
    headers: { Authorization: process.env.NETOPIA_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ posID: process.env.NETOPIA_POS_SIGNATURE, ntpID, orderID: linkId }),
  });
  const json = (await res.json()) as { payment?: { status?: number } };
  // 3 = plătit, 5 = confirmat
  if (json.payment?.status === 3 || json.payment?.status === 5) await markPaid(linkId, `netopia:${ntpID}`);
  return { errorCode: 0 };
}

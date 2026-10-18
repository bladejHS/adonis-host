"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@adonis/database";
import { CheckinError, createPaymentLink, findByToken, markPaid, offersForReservation, submitCheckin, trackUpsell, type CheckinInput } from "@adonis/core";

export type CheckinResult = { ok: true } | { ok: false; field: string; message: string };

export async function sendCheckin(input: Omit<CheckinInput, "ip" | "userAgent">): Promise<CheckinResult> {
  const h = headers();
  try {
    await submitCheckin({ ...input, ip: (h.get("x-forwarded-for") ?? "").split(",")[0] || undefined, userAgent: h.get("user-agent") ?? undefined });
    return { ok: true };
  } catch (e) {
    if (e instanceof CheckinError) return { ok: false, field: e.field, message: e.message };
    console.error(e);
    return { ok: false, field: "form", message: "Nu am putut salva check-in-ul. Încercați din nou sau sunați la recepție: 0742 100 480." };
  }
}

export async function buyOffers(token: string, offerIds: string[]) {
  const r = await findByToken(token);
  if (!r || !offerIds.length) return { error: "Alegeți cel puțin o ofertă." };
  const eligible = (await offersForReservation(r.id)).filter((o) => offerIds.includes(o.id) && !o.bought);
  if (!eligible.length) return { error: "Ofertele alese nu mai sunt disponibile pentru sejurul dumneavoastră." };
  await trackUpsell(eligible.map((o) => o.id), r.id, "click");
  const purchases = await prisma.$transaction(
    eligible.map((o) => prisma.upsellPurchase.create({ data: { offerId: o.id, reservationId: r.id, quantity: o.quantity, amount: o.price, status: "pending" } })),
  );
  const link = await createPaymentLink({
    reservationId: r.id,
    purpose: "upsell",
    amount: eligible.reduce((s, o) => s + o.total, 0),
    description: `Hostel Adonis · ${eligible.map((o) => o.title).join(", ")}`.slice(0, 200),
    purchaseIds: purchases.map((p) => p.id),
  });
  redirect(link.url!);
}

/** Doar pentru modul demo (fără Stripe/Netopia configurate). */
export async function confirmDemoPayment(linkId: string) {
  const link = await prisma.paymentLink.findUnique({ where: { id: linkId } });
  if (!link || link.provider !== "demo") return;
  await markPaid(linkId, "demo");
  redirect(`/plata/multumim?link=${linkId}`);
}

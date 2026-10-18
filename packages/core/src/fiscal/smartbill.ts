// SmartBill Cloud — emitere factură. Dacă în contul SmartBill e activată trimiterea automată în SPV,
// factura ajunge în e-Factura ANAF fără alt pas. Fără credențiale, funcția refuză explicit.

import { prisma } from "@adonis/database";

const BASE = "https://ws.smartbill.ro/SBORO/api";

export function smartbillConfigured() {
  return Boolean(process.env.SMARTBILL_EMAIL && process.env.SMARTBILL_TOKEN && process.env.SMARTBILL_CIF);
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env.SMARTBILL_EMAIL}:${process.env.SMARTBILL_TOKEN}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { errorText?: string };
  if (!res.ok || json.errorText) throw new Error(`SmartBill: ${json.errorText || res.status}`);
  return json;
}

export async function sendInvoiceToSmartBill(invoiceId: string) {
  if (!smartbillConfigured()) throw new Error("SmartBill nu e configurat. Completați SMARTBILL_EMAIL, SMARTBILL_TOKEN și SMARTBILL_CIF.");
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { guest: true } });
  const lines = JSON.parse(inv.lines) as { description: string; qty: number; unitPrice: number; vatRate: number }[];
  const out = await call<{ number: string; series: string }>("/invoice", {
    companyVatCode: process.env.SMARTBILL_CIF,
    client: {
      name: inv.buyerName, vatCode: inv.buyerCui ?? "", isTaxPayer: Boolean(inv.buyerCui), address: inv.buyerAddress ?? "",
      city: inv.guest?.city ?? "", country: "Romania", email: inv.guest?.email ?? "", saveToDb: false,
    },
    issueDate: inv.issueDate.toISOString().slice(0, 10),
    seriesName: process.env.SMARTBILL_SERIES ?? inv.series,
    isDraft: false,
    products: lines.map((l) => ({
      name: l.description, isDiscount: false, measuringUnitName: "buc", currency: "RON", quantity: l.qty, price: l.unitPrice,
      isTaxIncluded: false, taxName: "Redusa", taxPercentage: l.vatRate, isService: true, saveToDb: false,
    })),
    mentions: inv.touristTax > 0 ? `Taxa turistică ${inv.touristTax.toFixed(2)} lei încasată separat.` : undefined,
  });
  return prisma.invoice.update({ where: { id: invoiceId }, data: { smartbillId: `${out.series}${out.number}`, efacturaStatus: "sent" } });
}

// Factură electronică UBL 2.1, profil CIUS-RO (e-Factura ANAF).
// Taxa turistică nu intră în baza de TVA și nu face parte din livrare: se menționează în notă
// și se încasează separat (chitanță), ca factura să respecte regulile EN 16931.

import { round2 } from "@adonis/database";

export type UblLine = { description: string; qty: number; unitPrice: number; vatRate: number };
export type UblParty = {
  name: string;
  vatId?: string | null; // „RO12345678” pentru plătitori de TVA
  regId?: string | null; // J13/…/2015 sau CNP pentru persoane fizice
  street: string;
  city: string;
  countyCode: string; // ISO 3166-2:RO, ex: RO-CT
  country?: string;
  email?: string | null;
};
export type UblInvoice = {
  id: string; // ADN00012
  issueDate: Date;
  dueDate?: Date;
  currency?: string;
  supplier: UblParty;
  customer: UblParty;
  lines: UblLine[];
  note?: string;
  paymentMeans?: { iban?: string; code?: "10" | "30" | "48" }; // 10 numerar, 30 transfer, 48 card
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const amt = (n: number) => round2(n).toFixed(2);
const d = (x: Date) => x.toISOString().slice(0, 10);

/** Codurile județelor (ISO 3166-2:RO) cerute de CIUS-RO pentru CountrySubentity. */
export const COUNTY_CODE: Record<string, string> = {
  Constanța: "RO-CT", Constanta: "RO-CT", București: "RO-B", Bucuresti: "RO-B", Ilfov: "RO-IF", Prahova: "RO-PH", Brașov: "RO-BV", Cluj: "RO-CJ",
  Timiș: "RO-TM", Iași: "RO-IS", Dolj: "RO-DJ", Argeș: "RO-AG", Sibiu: "RO-SB", Bacău: "RO-BC", Buzău: "RO-BZ", Dâmbovița: "RO-DB", Tulcea: "RO-TL",
};

function party(p: UblParty, role: "Supplier" | "Customer") {
  const taxScheme = p.vatId
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(p.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : "";
  return `<cac:Accounting${role}Party><cac:Party>
    <cac:PostalAddress><cbc:StreetName>${esc(p.street)}</cbc:StreetName><cbc:CityName>${esc(p.city)}</cbc:CityName><cbc:CountrySubentity>${esc(p.countyCode)}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>${p.country ?? "RO"}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    ${taxScheme}
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName>${p.regId ? `<cbc:CompanyID>${esc(p.regId)}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity>
    ${p.email ? `<cac:Contact><cbc:ElectronicMail>${esc(p.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
  </cac:Party></cac:Accounting${role}Party>`;
}

export function buildUblInvoice(inv: UblInvoice) {
  const cur = inv.currency ?? "RON";
  const lines = inv.lines.map((l) => ({ ...l, net: round2(l.qty * l.unitPrice) }));
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.vatRate, round2((byRate.get(l.vatRate) ?? 0) + l.net));
  const subtotals = Array.from(byRate.entries()).map(([rate, base]) => ({ rate, base, tax: round2((base * rate) / 100) }));
  const net = round2(lines.reduce((s, l) => s + l.net, 0));
  const tax = round2(subtotals.reduce((s, x) => s + x.tax, 0));
  const cat = (rate: number) => (rate > 0 ? "S" : "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${esc(inv.id)}</cbc:ID>
  <cbc:IssueDate>${d(inv.issueDate)}</cbc:IssueDate>
  ${inv.dueDate ? `<cbc:DueDate>${d(inv.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${inv.note ? `<cbc:Note>${esc(inv.note)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  ${party(inv.supplier, "Supplier")}
  ${party(inv.customer, "Customer")}
  ${inv.paymentMeans ? `<cac:PaymentMeans><cbc:PaymentMeansCode>${inv.paymentMeans.code ?? "30"}</cbc:PaymentMeansCode>${inv.paymentMeans.iban ? `<cac:PayeeFinancialAccount><cbc:ID>${esc(inv.paymentMeans.iban)}</cbc:ID></cac:PayeeFinancialAccount>` : ""}</cac:PaymentMeans>` : ""}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${amt(tax)}</cbc:TaxAmount>
    ${subtotals
      .map(
        (s) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${cur}">${amt(s.base)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${cur}">${amt(s.tax)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${cat(s.rate)}</cbc:ID><cbc:Percent>${s.rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`,
      )
      .join("\n    ")}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${amt(net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${amt(net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${amt(net + tax)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${amt(net + tax)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines
    .map(
      (l, i) => `<cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="H87">${l.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${cur}">${amt(l.net)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${esc(l.description.slice(0, 200))}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${cat(l.vatRate)}</cbc:ID><cbc:Percent>${l.vatRate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${cur}">${amt(l.unitPrice)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("\n  ")}
</Invoice>
`;
}

/** Datele unei facturi din baza de date → UBL. */
export function invoiceToUbl(
  invoice: { series: string; number: number; issueDate: Date; buyerName: string; buyerCui: string | null; buyerAddress: string | null; lines: string; touristTax: number },
  property: { legalName: string | null; name: string; cui: string | null; regCom: string | null; address: string; city: string; county: string; email: string | null },
  guest?: { cnp: string | null; city: string | null; email: string | null } | null,
) {
  const lines = JSON.parse(invoice.lines) as UblLine[];
  return buildUblInvoice({
    id: `${invoice.series}${String(invoice.number).padStart(5, "0")}`,
    issueDate: invoice.issueDate,
    supplier: {
      name: property.legalName ?? property.name, vatId: property.cui ? (property.cui.startsWith("RO") ? property.cui : `RO${property.cui}`) : null, regId: property.regCom,
      street: property.address, city: property.city, countyCode: COUNTY_CODE[property.county] ?? "RO-CT", email: property.email,
    },
    customer: {
      name: invoice.buyerName, vatId: invoice.buyerCui, regId: invoice.buyerCui ? null : guest?.cnp ?? "0000000000000",
      street: invoice.buyerAddress ?? "-", city: guest?.city ?? "-", countyCode: "RO-CT", email: guest?.email ?? null,
    },
    lines,
    note: invoice.touristTax > 0 ? `Taxa turistică de ${invoice.touristTax.toFixed(2)} lei a fost încasată separat, pentru Primăria Costinești.` : undefined,
  });
}

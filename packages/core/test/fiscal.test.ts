import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { buildUblInvoice } from "../src/fiscal/ubl";
import { computeTouristTax, toCsv } from "../src/fiscal/registry";

const invoice = () =>
  buildUblInvoice({
    id: "ADN00042",
    issueDate: new Date("2027-07-17T00:00:00Z"),
    supplier: { name: "Adonis Turism SRL", vatId: "RO12345678", regId: "J13/100/2010", street: "Faleză", city: "Costinești", countyCode: "RO-CT" },
    customer: { name: "Maria Popescu", regId: "2851104400122", street: "Str. Lungă 1", city: "Brașov", countyCode: "RO-BV" },
    lines: [
      { description: "Cazare camera 21, 5 nopți", qty: 1, unitPrice: 2144.14, vatRate: 11 },
      { description: "Barca la răsărit & <bonus>", qty: 2, unitPrice: 135.14, vatRate: 11 },
    ],
    note: "Taxa turistică de 23.80 lei a fost încasată separat.",
  });

describe("e-Factura UBL CIUS-RO", () => {
  const doc = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(invoice()).Invoice;

  it("declară profilul CIUS-RO și tipul 380", () => {
    expect(doc.CustomizationID).toBe("urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1");
    expect(doc.InvoiceTypeCode).toBe(380);
    expect(doc.DocumentCurrencyCode).toBe("RON");
  });

  it("totalurile se potrivesc cu liniile", () => {
    const net = 2144.14 + 2 * 135.14;
    const tax = Math.round(net * 0.11 * 100) / 100;
    const total = doc.LegalMonetaryTotal;
    expect(Number(total.LineExtensionAmount["#text"])).toBeCloseTo(net, 2);
    expect(Number(doc.TaxTotal.TaxAmount["#text"])).toBeCloseTo(tax, 2);
    expect(Number(total.PayableAmount["#text"])).toBeCloseTo(net + tax, 2);
    expect(doc.InvoiceLine).toHaveLength(2);
  });

  it("are județul în format ISO și escapează textul", () => {
    expect(doc.AccountingSupplierParty.Party.PostalAddress.CountrySubentity).toBe("RO-CT");
    expect(invoice()).toContain("Barca la răsărit &amp; &lt;bonus&gt;");
  });
});

describe("evidență și taxe", () => {
  it("CSV-ul are BOM, separator „;” și escapează valorile", () => {
    const csv = toCsv([{ a: "Popescu; Ion", b: 'zis "Nea"' }], { a: "Nume", b: "Poreclă" });
    expect(csv.startsWith("﻿Nume;Poreclă")).toBe(true);
    expect(csv).toContain('"Popescu; Ion";"zis ""Nea"""');
  });

  it("calculează taxa turistică după regula localității", () => {
    expect(computeTouristTax({ mode: "percent", value: 1, }, 2380, 5, 2)).toBe(23.8);
    expect(computeTouristTax({ mode: "per_night_person", value: 1.5 }, 2380, 5, 2)).toBe(15);
  });
});

import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtLong, json, lei, today } from "@/lib/format";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Facturi & taxe" };

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
const EF: Record<string, [string, string]> = {
  not_sent: ["Netrimisă", "text-warning"],
  sent: ["Trimisă", "text-info"],
  accepted: ["Acceptată ANAF", "text-success"],
  rejected: ["Respinsă", "text-error"],
};

export default async function Invoices({ searchParams }: { searchParams: { f?: string; an?: string } }) {
  const year = Number(searchParams.an ?? today().getUTCFullYear());
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const [invoices, property, stays] = await Promise.all([
    prisma.invoice.findMany({ where: { issueDate: { gte: from, lt: to } }, include: { reservation: true }, orderBy: { number: "desc" } }),
    prisma.property.findFirstOrThrow(),
    prisma.reservation.findMany({ where: { status: { in: ["checked_out", "checked_in"] }, checkIn: { gte: from, lt: to } }, select: { checkIn: true, touristTax: true, totalAmount: true, adults: true } }),
  ]);
  const selected = searchParams.f ? invoices.find((i) => i.id === searchParams.f) : null;
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const vat = invoices.reduce((s, i) => s + i.vatAmount, 0);
  const notSent = invoices.filter((i) => i.efacturaStatus === "not_sent").length;

  const byMonth = Array.from({ length: 12 }, (_, m) => {
    const list = stays.filter((s) => s.checkIn.getUTCMonth() === m);
    return { m, tax: list.reduce((s, x) => s + x.touristTax, 0), base: list.reduce((s, x) => s + x.totalAmount, 0), count: list.length };
  }).filter((x) => x.count > 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Facturi & taxe" description={`Seria ${property.invoiceSeries} · TVA cazare ${property.vatRate}% · taxă turistică ${property.touristTaxMode === "percent" ? `${property.touristTaxValue}% din valoarea cazării` : `${property.touristTaxValue} lei / persoană / noapte`}`}>
        {[year - 1, year, year + 1].map((y) => (
          <Link key={y} href={`/facturi?an=${y}`} className={y === year ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{y}</Link>
        ))}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Facturat" value={lei(totalInvoiced)} tone="gold" hint={`${invoices.length} facturi`} />
        <Stat label="TVA colectat" value={lei(vat)} />
        <Stat label="Taxă turistică" value={lei(byMonth.reduce((s, x) => s + x.tax, 0))} hint="de virat la Primăria Costinești" />
        <Stat label="Netrimise în e-Factura" value={notSent} hint={notSent ? "trimitere automată în Faza 4" : "toate trimise"} />
      </div>

      {selected && (
        <section className="card mx-auto max-w-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-gold-300 via-gold to-gold-600" />
          <div className="space-y-6 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <img src="/brand/adonis-logo-horizontal.svg" alt="Hostel Adonis Costinești" className="h-14" />
              <div className="text-right">
                <p className="label">Factură</p>
                <p className="num font-display text-3xl text-heading">{selected.series} {String(selected.number).padStart(5, "0")}</p>
                <p className="text-sm text-subtle">{fmtLong(selected.issueDate)}</p>
              </div>
            </div>
            <div className="grid gap-6 text-sm sm:grid-cols-2">
              <div><p className="label mb-1">Furnizor</p><p className="text-heading">{property.legalName ?? property.name}</p><p className="text-subtle">{property.address}, {property.city}, jud. {property.county}</p>{property.cui && <p className="text-subtle">CUI {property.cui}</p>}</div>
              <div><p className="label mb-1">Client</p><p className="text-heading">{selected.buyerName}</p>{selected.buyerCui && <p className="text-subtle">CUI {selected.buyerCui}</p>}{selected.reservation && <p className="text-subtle">Rezervarea {selected.reservation.code}</p>}</div>
            </div>
            <table className="table-lux">
              <thead><tr><th>Descriere</th><th className="text-right">Cant.</th><th className="text-right">Preț fără TVA</th><th className="text-right">TVA</th></tr></thead>
              <tbody>
                {json<{ description: string; qty: number; unitPrice: number; vatRate: number }[]>(selected.lines, []).map((l, i) => (
                  <tr key={i}><td>{l.description}</td><td className="num text-right">{l.qty}</td><td className="num text-right">{lei(l.unitPrice, true)}</td><td className="num text-right">{l.vatRate}%</td></tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-subtle">Subtotal</dt><dd className="num">{lei(selected.subtotal, true)}</dd></div>
              <div className="flex justify-between"><dt className="text-subtle">TVA</dt><dd className="num">{lei(selected.vatAmount, true)}</dd></div>
              <div className="flex justify-between"><dt className="text-subtle">Taxă turistică</dt><dd className="num">{lei(selected.touristTax, true)}</dd></div>
              <div className="rule-gold my-2" />
              <div className="flex justify-between font-display text-2xl text-heading"><dt>Total</dt><dd className="num">{lei(selected.total, true)}</dd></div>
            </dl>
            <p className="text-center font-display text-lg italic text-gold-text">Vă mulțumim și vă așteptăm cu drag la malul mării.</p>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Facturi emise" bodyClass="p-0 overflow-x-auto">
          {invoices.length === 0 ? (
            <Empty title={`Nicio factură în ${year}`}>Facturile se emit din pagina rezervării.</Empty>
          ) : (
            <table className="table-lux min-w-[640px]">
              <thead><tr><th>Număr</th><th>Data</th><th>Client</th><th>e-Factura</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {invoices.slice(0, 80).map((i) => (
                  <tr key={i.id} className={i.id === selected?.id ? "bg-gold-50" : ""}>
                    <td><Link href={`/facturi?an=${year}&f=${i.id}`} className="num text-gold-text hover:underline">{i.series} {String(i.number).padStart(5, "0")}</Link></td>
                    <td className="num text-sm">{fmtLong(i.issueDate)}</td>
                    <td>{i.buyerName}</td>
                    <td className={`text-xs ${EF[i.efacturaStatus]?.[1]}`}>{EF[i.efacturaStatus]?.[0]}</td>
                    <td className="num text-right">{lei(i.total, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title={`Taxă turistică ${year}`} bodyClass="p-0">
          <table className="table-lux">
            <thead><tr><th>Luna</th><th className="text-right">Sejururi</th><th className="text-right">Bază</th><th className="text-right">Taxă</th></tr></thead>
            <tbody>
              {byMonth.map((x) => (
                <tr key={x.m}><td>{MONTHS[x.m]}</td><td className="num text-right">{x.count}</td><td className="num text-right">{lei(x.base)}</td><td className="num text-right text-heading">{lei(x.tax, true)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-subtle">Cota se modifică din Setări, după hotărârea Consiliului Local Costinești.</p>
        </Card>
      </div>
    </div>
  );
}

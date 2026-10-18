import { Link, useSearchParams } from "react-router-dom";
import { computeKpis, computeMonthlySeries } from "@adonis/core/pure";
import { Card, PageHeader, Stat, sourceColor } from "@/components/ui";
import { RevenueOccupancyChart, SimpleBars } from "@/components/charts";
import { useDb } from "../data/store";
import { SOURCE_LABEL, lei, pct, today } from "../lib";

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

export function Reports() {
  const db = useDb();
  const [sp] = useSearchParams();
  const year = Number(sp.get("an") ?? today().getUTCFullYear());
  const k = computeKpis(db.rooms.length, db.reservations, new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)));
  const months = computeMonthlySeries(db.rooms.length, db.reservations, year, [4, 5, 6, 7, 8, 9, 10]);
  const commission = Object.fromEntries(db.channels.map((c) => [c.kind, c.commissionPct]));
  const channelRows = Object.entries(k.byChannel).map(([src, v]) => ({ src, ...v, commission: (v.revenue * (commission[src] ?? 0)) / 100 })).sort((a, b) => b.revenue - a.revenue);
  const best = months.reduce((m, x) => (x.revenue > m.revenue ? x : m), months[0]);
  const extra = db.purchases.filter((p) => p.status === "paid" && p.createdAt.getUTCFullYear() === year).reduce((s, p) => s + p.amount * p.quantity, 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title={`Rapoarte ${year}`} description="Ocupare, tarif mediu și venit pe camera disponibilă, calculate pe nopțile efectiv vândute.">
        {[year - 1, year, year + 1].map((y) => <Link key={y} to={`/rapoarte?an=${y}`} className={y === year ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{y}</Link>)}
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Venit cazare" value={lei(k.revenue)} tone="gold" hint={`+ ${lei(extra)} din extra`} />
        <Stat label="Nopți vândute" value={k.sold.toLocaleString("ro-RO")} hint={`din ${k.available.toLocaleString("ro-RO")} disponibile`} />
        <Stat label="ADR" value={lei(k.adr)} hint="tarif mediu / noapte" />
        <Stat label="RevPAR" value={lei(k.revpar)} hint="venit / cameră disponibilă" />
        <Stat label="Anulări" value={pct(k.cancellationRate)} hint={`${k.bookings} sosiri`} />
      </div>
      <Card title="Sezonul, lună de lună" action={best && best.revenue > 0 ? <span className="text-xs text-subtle">Cea mai bună lună: <span className="text-heading">{MONTHS[best.month - 1]}</span> · {pct(best.occupancy)} ocupare</span> : null}>
        <RevenueOccupancyChart data={months.map((m) => ({ label: MONTHS[m.month - 1], revenue: Math.round(m.revenue), occupancy: m.occupancy }))} />
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Pe canale" bodyClass="p-0 overflow-x-auto">
          <table className="table-lux min-w-[520px]">
            <thead><tr><th>Canal</th><th className="text-right">Sosiri</th><th className="text-right">Nopți</th><th className="text-right">Venit</th><th className="text-right">Comision</th></tr></thead>
            <tbody>
              {channelRows.map((c) => (
                <tr key={c.src}>
                  <td><span className="mr-2 inline-block h-2 w-2 rotate-45" style={{ background: sourceColor[c.src] }} />{SOURCE_LABEL[c.src] ?? c.src}</td>
                  <td className="num text-right">{c.count}</td><td className="num text-right">{c.nights}</td><td className="num text-right">{lei(c.revenue)}</td>
                  <td className="num text-right text-subtle">{c.commission ? lei(c.commission) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-subtle">Fiecare rezervare directă economisește comisionul Booking ({commission.booking ?? 15}%).</p>
        </Card>
        <Card title="Tarif mediu pe lună (ADR)"><SimpleBars data={months.filter((m) => m.sold > 0).map((m) => ({ label: MONTHS[m.month - 1], value: Math.round(m.adr) }))} /></Card>
      </div>
      <Card title="Detaliu lunar" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[640px]">
          <thead><tr><th>Luna</th><th className="text-right">Ocupare</th><th className="text-right">Nopți</th><th className="text-right">ADR</th><th className="text-right">RevPAR</th><th className="text-right">Venit</th></tr></thead>
          <tbody>{months.map((m) => <tr key={m.month}><td className="capitalize">{MONTHS[m.month - 1]}</td><td className="num text-right">{pct(m.occupancy)}</td><td className="num text-right">{m.sold}</td><td className="num text-right">{lei(m.adr)}</td><td className="num text-right">{lei(m.revpar)}</td><td className="num text-right text-heading">{lei(m.revenue)}</td></tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
}

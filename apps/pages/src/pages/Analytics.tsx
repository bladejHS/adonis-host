import { Link, useSearchParams } from "react-router-dom";
import { computeSatisfaction, computeWeeklySeasonality, holidays, REVIEW_SOURCE } from "@adonis/core/pure";
import { Card, PageHeader, Stat } from "@/components/ui";
import { RatingBars, SeasonalityChart } from "@/components/charts";
import { useDb } from "../data/store";
import { markReplied, refreshAlerts, resolveAlert } from "../data/actions";
import { Empty, fmtLong, fmtShort, relTime, today } from "../lib";

const SEVERITY: Record<string, string> = { critical: "border-l-error", warning: "border-l-warning", info: "border-l-info" };

export function Analytics() {
  const db = useDb();
  const [sp] = useSearchParams();
  const year = Number(sp.get("an") ?? today().getUTCFullYear());
  const weeks = computeWeeklySeasonality(db.rooms.length, db.reservations, year);
  const lastYear = computeWeeklySeasonality(db.rooms.length, db.reservations, year - 1);
  const sat = computeSatisfaction(db.reviews);
  const alerts = db.alerts.filter((a) => !a.resolvedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const marks = holidays(year)
    .map((h) => {
      const t = new Date(h.date + "T00:00:00Z").getTime();
      const w = weeks.find((x) => x.start.getTime() <= t && x.start.getTime() + 7 * 86_400_000 > t);
      return w ? { label: fmtShort(w.start), name: h.name } : null;
    })
    .filter(Boolean)
    .reduce<{ label: string; name: string }[]>((acc, m) => {
      const same = acc.find((x) => x.label === m!.label);
      if (same) same.name = `${same.name} · ${m!.name}`;
      else acc.push({ ...m! });
      return acc;
    }, []);
  const avg = weeks.reduce((s, w) => s + w.occupancy, 0) / (weeks.length || 1);
  const lyAvg = lastYear.reduce((s, w) => s + w.occupancy, 0) / (lastYear.length || 1);
  const peak = weeks.reduce((m, w) => (w.occupancy > m.occupancy ? w : m), weeks[0]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Analitice & alerte" description="Când vin oaspeții, cât de mulțumiți pleacă și ce merită atenție azi.">
        {[year - 1, year].map((y) => <Link key={y} to={`/analitice?an=${y}`} className={y === year ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{y}</Link>)}
      </PageHeader>
      <Card title={`Alerte deschise (${alerts.length})`} action={<button className="btn-ghost btn-sm" onClick={refreshAlerts}>Verifică acum</button>} bodyClass="p-0">
        {alerts.length === 0 ? <Empty title="Totul e în regulă">Apăsați „Verifică acum”: verificăm recenziile, stocurile, suprapunerile și ritmul rezervărilor.</Empty> : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-start gap-4 border-l-2 px-5 py-4 ${SEVERITY[a.severity] ?? ""}`}>
                <div className="min-w-0 flex-1"><p className="font-medium text-heading">{a.title}</p><p className="text-sm text-subtle">{a.body}</p><p className="mt-1 text-xs text-subtle">{relTime(a.createdAt)}</p></div>
                {a.link && <Link to={a.link} className="btn-ghost btn-sm">Deschide</Link>}
                <button className="btn-ghost btn-sm" onClick={() => resolveAlert(a.id)}>Rezolvată</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ocupare medie apr–oct" value={`${Math.round(avg * 100)}%`} hint={lyAvg ? `${year - 1}: ${Math.round(lyAvg * 100)}%` : "fără date pentru anul trecut"} tone="gold" />
        <Stat label="Săptămâni pline (≥ 90%)" value={weeks.filter((w) => w.occupancy >= 0.9).length} />
        <Stat label="Vârful sezonului" value={peak ? fmtShort(peak.start) : "—"} hint={peak ? `${Math.round(peak.occupancy * 100)}% ocupare` : ""} />
        <Stat label="Nota medie" value={sat.average ? sat.average.toFixed(1) : "—"} hint={`${sat.count} recenzii`} />
      </div>
      <Card title={`Sezonalitate ${year}, pe săptămâni`}>
        <SeasonalityChart data={weeks.map((w) => ({ label: fmtShort(w.start), occupancy: w.occupancy, revenue: Math.round(w.revenue) }))} marks={marks} />
        <p className="mt-3 text-xs text-subtle">Bare: ocupare. Linie aurie: venit săptămânal. Liniile punctate marchează sărbătorile care umplu stațiunea.</p>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Satisfacția oaspeților">
          <div className="space-y-6">
            <RatingBars data={sat.buckets.map((b) => ({ label: b.label, count: b.count }))} />
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              {Object.entries(sat.bySource).map(([k, v]) => <div key={k}><p className="label">{REVIEW_SOURCE[k] ?? k}</p><p className="num font-display text-2xl text-heading">{v.avg.toFixed(1)}</p><p className="text-xs text-subtle">{v.count} recenzii</p></div>)}
            </div>
            <div className="border-t border-line pt-4">
              <p className="label mb-2">Ce apare cel mai des în comentarii</p>
              <div className="flex flex-wrap gap-2">{sat.themes.filter((t) => t.count > 0).map((t) => <span key={t.name} className="rounded-full border border-line px-3 py-1 text-xs">{t.name} <span className="num text-subtle">{t.count}</span></span>)}</div>
            </div>
          </div>
        </Card>
        <Card title="Recenzii recente" bodyClass="p-0">
          <ul className="divide-y divide-line">
            {sat.latest.map((r) => (
              <li key={r.id} className="flex gap-4 px-5 py-4">
                <span className={`num font-display text-3xl leading-none ${r.rating < 6 ? "text-error" : r.rating >= 9 ? "text-success" : "text-heading"}`}>{r.rating.toFixed(1)}</span>
                <div className="min-w-0 flex-1 space-y-1"><p className="text-heading">{r.title}</p><p className="text-sm text-subtle">{r.comment}</p><p className="text-xs text-subtle">{r.author} · {REVIEW_SOURCE[r.source] ?? r.source} · {fmtLong(r.createdAt)}{r.repliedAt ? " · am răspuns" : ""}</p></div>
                {!r.repliedAt && r.rating < 8 && <button className="btn-ghost btn-sm" onClick={() => markReplied(r.id)}>Am răspuns</button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

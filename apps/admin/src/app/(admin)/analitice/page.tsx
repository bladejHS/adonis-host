import Link from "next/link";
import { holidays, satisfaction, weeklySeasonality } from "@adonis/core";
import { prisma } from "@/lib/db";
import { fmtLong, fmtShort, relTime, today } from "@/lib/format";
import { checkAlerts, markReviewReplied, resolveAlert } from "@/lib/actions";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { RatingBars, SeasonalityChart } from "@/components/charts";
import { Submit } from "@/components/submit";

export const metadata = { title: "Analitice & alerte" };

const SOURCE: Record<string, string> = { booking: "Booking.com", airbnb: "Airbnb", google: "Google", direct: "Direct" };
const SEVERITY: Record<string, string> = { critical: "border-l-error", warning: "border-l-warning", info: "border-l-info" };

export default async function Analytics({ searchParams }: { searchParams: { an?: string } }) {
  const year = Number(searchParams.an ?? today().getUTCFullYear());
  const [weeks, sat, alerts, lastYearWeeks] = await Promise.all([
    weeklySeasonality(year),
    satisfaction(),
    prisma.alert.findMany({ where: { resolvedAt: null }, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] }),
    weeklySeasonality(year - 1),
  ]);
  const hol = holidays(year);
  const label = (d: Date) => fmtShort(d);
  const marks = hol
    .map((h) => {
      const t = new Date(h.date + "T00:00:00Z").getTime();
      const w = weeks.find((x) => x.start.getTime() <= t && x.start.getTime() + 7 * 86_400_000 > t);
      return w ? { label: label(w.start), name: h.name } : null;
    })
    .filter(Boolean)
    // sărbătorile din aceeași săptămână (ex: Rusalii și 1 Iunie) primesc o singură etichetă
    .reduce<{ label: string; name: string }[]>((acc, m) => {
      const same = acc.find((x) => x.label === m!.label);
      if (same) same.name = `${same.name} · ${m!.name}`;
      else acc.push({ ...m! });
      return acc;
    }, []);
  const peak = weeks.reduce((m, w) => (w.occupancy > m.occupancy ? w : m), weeks[0]);
  const fullWeeks = weeks.filter((w) => w.occupancy >= 0.9).length;
  const lyAvg = lastYearWeeks.reduce((s, w) => s + w.occupancy, 0) / (lastYearWeeks.length || 1);
  const avg = weeks.reduce((s, w) => s + w.occupancy, 0) / (weeks.length || 1);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Analitice & alerte" description="Când vin oaspeții, cât de mulțumiți pleacă și ce merită atenție azi.">
        {[year - 1, year].map((y) => (
          <Link key={y} href={`/analitice?an=${y}`} className={y === year ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{y}</Link>
        ))}
      </PageHeader>

      <Card
        title={`Alerte deschise (${alerts.length})`}
        action={
          <form action={checkAlerts}>
            <Submit className="btn-ghost btn-sm" pendingText="Se verifică…">Verifică acum</Submit>
          </form>
        }
        bodyClass="p-0"
      >
        {alerts.length === 0 ? (
          <Empty title="Totul e în regulă">Verificăm zilnic ritmul rezervărilor, recenziile, stocurile și sincronizarea.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-start gap-4 border-l-2 px-5 py-4 ${SEVERITY[a.severity] ?? ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-heading">{a.title}</p>
                  <p className="text-sm text-subtle">{a.body}</p>
                  <p className="mt-1 text-xs text-subtle">{relTime(a.createdAt)}</p>
                </div>
                {a.link && <Link href={a.link} className="btn-ghost btn-sm">Deschide</Link>}
                <form action={resolveAlert.bind(null, a.id)}><button className="btn-ghost btn-sm">Rezolvată</button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ocupare medie apr–oct" value={`${Math.round(avg * 100)}%`} hint={lyAvg ? `${year - 1}: ${Math.round(lyAvg * 100)}%` : "fără date pentru anul trecut"} tone="gold" />
        <Stat label="Săptămâni pline (≥ 90%)" value={fullWeeks} />
        <Stat label="Vârful sezonului" value={peak ? fmtShort(peak.start) : "—"} hint={peak ? `${Math.round(peak.occupancy * 100)}% ocupare` : ""} />
        <Stat label="Nota medie" value={sat.average ? sat.average.toFixed(1) : "—"} hint={`${sat.count} recenzii`} />
      </div>

      <Card title={`Sezonalitate ${year}, pe săptămâni`}>
        <SeasonalityChart data={weeks.map((w) => ({ label: label(w.start), occupancy: w.occupancy, revenue: Math.round(w.revenue) }))} marks={marks} />
        <p className="mt-3 text-xs text-subtle">Bare: ocupare. Linie aurie: venit săptămânal. Liniile punctate marchează sărbătorile care umplu stațiunea: {hol.map((h) => h.name).join(", ")}.</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Satisfacția oaspeților">
          <div className="space-y-6">
            <RatingBars data={sat.buckets.map((b) => ({ label: b.label, count: b.count }))} />
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
              {Object.entries(sat.bySource).map(([k, v]) => (
                <div key={k}>
                  <p className="label">{SOURCE[k] ?? k}</p>
                  <p className="num font-display text-2xl text-heading">{v.avg.toFixed(1)}</p>
                  <p className="text-xs text-subtle">{v.count} recenzii</p>
                </div>
              ))}
            </div>
            <div className="border-t border-line pt-4">
              <p className="label mb-2">Ce apare cel mai des în comentarii</p>
              <div className="flex flex-wrap gap-2">
                {sat.themes.filter((t) => t.count > 0).map((t) => (
                  <span key={t.name} className="rounded-full border border-line px-3 py-1 text-xs">{t.name} <span className="num text-subtle">{t.count}</span></span>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Recenzii recente" bodyClass="p-0">
          <ul className="divide-y divide-line">
            {sat.latest.map((r) => (
              <li key={r.id} className="flex gap-4 px-5 py-4">
                <span className={`num font-display text-3xl leading-none ${r.rating < 6 ? "text-error" : r.rating >= 9 ? "text-success" : "text-heading"}`}>{r.rating.toFixed(1)}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-heading">{r.title}</p>
                  <p className="text-sm text-subtle">{r.comment}</p>
                  <p className="text-xs text-subtle">{r.author} · {SOURCE[r.source] ?? r.source} · {fmtLong(r.createdAt)}{r.repliedAt ? " · am răspuns" : ""}</p>
                </div>
                {!r.repliedAt && r.rating < 8 && (
                  <form action={markReviewReplied.bind(null, r.id)}><button className="btn-ghost btn-sm">Am răspuns</button></form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

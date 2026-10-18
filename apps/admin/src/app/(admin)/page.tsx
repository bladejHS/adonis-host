import Link from "next/link";
import { ArrowRight, LogIn, LogOut, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { kpis, dailyOccupancy } from "@/lib/kpi";
import { addDays, fmtShort, fmtWeekday, greeting, lei, pct, plural, relTime, today } from "@/lib/format";
import { setReservationStatus } from "@/lib/actions";
import { Card, Empty, HousekeepingBadge, Notice, SourceTag, StatusBadge, Stat, sourceColor } from "@/components/ui";
import { ChannelDonut, OccupancyStrip } from "@/components/charts";
import { SOURCE } from "@adonis/database";

export default async function Dashboard() {
  const t = today();
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const [arrivals, departures, inHouse, rooms, tasksOpen, syncErr, unpaid, season, next14, property] = await Promise.all([
    prisma.reservation.findMany({ where: { checkIn: t, status: { in: ["pending", "confirmed", "checked_in"] } }, include: { guest: true, room: true }, orderBy: { room: { number: "asc" } } }),
    prisma.reservation.findMany({ where: { checkOut: t, status: { in: ["checked_in", "checked_out"] } }, include: { guest: true, room: true }, orderBy: { room: { number: "asc" } } }),
    prisma.reservation.count({ where: { status: "checked_in" } }),
    prisma.room.findMany({ orderBy: { number: "asc" } }),
    prisma.housekeepingTask.count({ where: { status: { in: ["todo", "in_progress"] } } }),
    prisma.channelSyncLog.findFirst({ where: { status: "error" }, orderBy: { startedAt: "desc" }, include: { channel: true } }),
    prisma.reservation.findMany({ where: { status: { in: ["confirmed", "pending"] }, checkIn: { gte: t, lte: addDays(t, 7) } }, include: { guest: true, room: true } }),
    kpis(yearStart, addDays(t, 1)),
    dailyOccupancy(t, 14),
    prisma.property.findFirstOrThrow(),
  ]);

  const outstanding = unpaid.filter((r) => r.paidAmount < r.totalAmount + r.touristTax);
  const pendingCount = unpaid.filter((r) => r.status === "pending").length;
  const byHk = rooms.reduce<Record<string, number>>((a, r) => ((a[r.housekeeping] = (a[r.housekeeping] ?? 0) + 1), a), {});
  const occToday = next14[0]?.rate ?? 0;
  const channelData = Object.entries(season.byChannel)
    .map(([k, v]) => ({ name: SOURCE[k as keyof typeof SOURCE] ?? k, value: Math.round(v.revenue), color: sourceColor[k] ?? "#8c8170" }))
    .sort((a, b) => b.value - a.value);
  const seasonTotal = channelData.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-8">
      {/* Antet cu fotografie din arhivă */}
      <section className="relative overflow-hidden rounded-lg bg-navy-900 text-ivory-50">
        <img src="/photos/sea-balcony.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-900/85 to-navy-900/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-9 sm:px-10">
          <div className="space-y-3">
            <p className="label text-gold-300">{fmtWeekday(t)}</p>
            <h1 className="text-[2.75rem] leading-[1.05] text-ivory-25">
              {greeting()}, <em className="font-normal text-gold-300">Adonis</em>
            </h1>
            <p className="max-w-lg text-navy-200">
              {arrivals.length || departures.length
                ? `Azi ${plural(arrivals.length, "sosire", "sosiri")} și ${plural(departures.length, "plecare", "plecări")}. ${plural(inHouse, "cameră ocupată", "camere ocupate")} din ${rooms.length}.`
                : `O zi liniștită la malul mării. ${plural(inHouse, "cameră ocupată", "camere ocupate")} din ${rooms.length}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rezervari/noua" className="btn-gold">
              <Plus size={16} strokeWidth={1.6} /> Rezervare nouă
            </Link>
            <Link href="/calendar" className="btn border border-white/20 text-ivory-50 hover:border-gold hover:text-gold-300">
              Calendar
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Ocupare azi" value={pct(occToday)} hint={`${next14[0]?.occupied ?? 0} din ${rooms.length} camere`} tone="gold" />
        <Stat label={`Venit cazare ${t.getUTCFullYear()}`} value={lei(season.revenue)} hint={`${plural(season.sold, "noapte vândută", "nopți vândute")}`} />
        <Stat label="Tarif mediu (ADR)" value={lei(season.adr)} hint={`RevPAR ${lei(season.revpar)}`} />
        <Stat label="Anulări" value={pct(season.cancellationRate)} hint={`din ${plural(season.bookings, "rezervare", "rezervări")} în ${t.getUTCFullYear()}`} />
      </div>

      {(syncErr || outstanding.length > 0 || byHk.maintenance || pendingCount > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {pendingCount > 0 && (
            <Notice tone="warning" title={`${plural(pendingCount, "rezervare așteaptă", "rezervări așteaptă")} confirmare`}>
              Sosesc în următoarele 7 zile. <Link href="/rezervari?status=pending" className="underline decoration-gold underline-offset-4">Vezi lista</Link>
            </Notice>
          )}
          {outstanding.length > 0 && (
            <Notice tone="info" title={`${plural(outstanding.length, "sosire", "sosiri")} cu rest de plată`}>
              {outstanding.slice(0, 3).map((r) => `${r.guest.lastName} (cam. ${r.room.number}): ${lei(r.totalAmount + r.touristTax - r.paidAmount)}`).join(" · ")}
            </Notice>
          )}
          {byHk.maintenance ? (
            <Notice tone="error" title={`${plural(byHk.maintenance, "cameră", "camere")} în reparație`}>
              {rooms.filter((r) => r.housekeeping === "maintenance").map((r) => `Camera ${r.number}${r.notes ? `: ${r.notes}` : ""}`).join(" · ")}
            </Notice>
          ) : null}
          {syncErr && (
            <Notice tone="warning" title={`Ultima eroare de sincronizare · ${syncErr.channel.name}`}>
              {syncErr.message} <span className="text-subtle">({relTime(syncErr.startedAt)})</span>
            </Notice>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={<h2 className="flex items-center gap-2 text-xl"><LogIn size={18} strokeWidth={1.4} className="text-gold" /> Sosiri azi</h2>} bodyClass="p-0">
          {arrivals.length === 0 ? (
            <Empty title="Nicio sosire azi" />
          ) : (
            <ul className="divide-y divide-line">
              {arrivals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="num w-10 font-display text-2xl text-heading">{r.room.number}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/rezervari/${r.id}`} className="font-medium text-heading hover:text-gold-text">{r.guest.firstName} {r.guest.lastName}</Link>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-subtle">
                      <SourceTag source={r.source} />
                      <span>{r.adults + r.children} pers. · până pe {fmtShort(r.checkOut)}</span>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                  {r.status !== "checked_in" && (
                    <form action={setReservationStatus.bind(null, r.id, "checked_in")}>
                      <button className="btn-ghost btn-sm">Check-in</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<h2 className="flex items-center gap-2 text-xl"><LogOut size={18} strokeWidth={1.4} className="text-gold" /> Plecări azi</h2>} bodyClass="p-0">
          {departures.length === 0 ? (
            <Empty title="Nicio plecare azi" />
          ) : (
            <ul className="divide-y divide-line">
              {departures.map((r) => {
                const due = r.totalAmount + r.touristTax - r.paidAmount;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="num w-10 font-display text-2xl text-heading">{r.room.number}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/rezervari/${r.id}`} className="font-medium text-heading hover:text-gold-text">{r.guest.firstName} {r.guest.lastName}</Link>
                      <p className="text-xs text-subtle">{due > 0 ? <span className="text-warning">Rest de plată {lei(due)}</span> : "Achitat integral"}</p>
                    </div>
                    {r.status === "checked_in" ? (
                      <form action={setReservationStatus.bind(null, r.id, "checked_out")}>
                        <button className="btn-ghost btn-sm">Check-out</button>
                      </form>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Următoarele 14 zile" action={<Link href="/calendar" className="text-xs text-gold-text hover:underline">Deschide calendarul <ArrowRight className="inline" size={12} /></Link>}>
          <OccupancyStrip data={next14.map((d) => ({ label: fmtShort(d.day), rate: d.rate }))} />
          <div className="mt-4 grid grid-cols-7 gap-1.5 sm:grid-cols-14">
            {next14.map((d) => (
              <div key={d.day.toISOString()} className="rounded-sm border border-line px-1 py-2 text-center">
                <p className="text-[0.625rem] uppercase text-subtle">{fmtShort(d.day).split(" ")[1]}</p>
                <p className="num font-display text-lg leading-none text-heading">{d.day.getUTCDate()}</p>
                <p className="num mt-1 text-[0.6875rem] text-gold-text">{d.occupied}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title={`Venit pe canale · ${t.getUTCFullYear()}`}>
          <ChannelDonut data={channelData} />
          <ul className="mt-2 space-y-2 text-sm">
            {channelData.map((c) => (
              <li key={c.name} className="flex items-center gap-3">
                <span className="h-2 w-2 rotate-45" style={{ background: c.color }} />
                <span className="flex-1">{c.name}</span>
                <span className="num text-subtle">{seasonTotal ? Math.round((c.value / seasonTotal) * 100) : 0}%</span>
                <span className="num w-28 text-right">{lei(c.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Starea camerelor" action={<Link href="/curatenie" className="text-xs text-gold-text hover:underline">{plural(tasksOpen, "sarcină deschisă", "sarcini deschise")} <ArrowRight className="inline" size={12} /></Link>}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {rooms.map((r) => (
            <Link key={r.id} href="/camere" title={`Camera ${r.number}`} className="group rounded-sm border border-line px-2 py-2.5 text-center transition-colors hover:border-gold">
              <p className="num font-display text-xl leading-none text-heading">{r.number}</p>
              <span
                className="mx-auto mt-2 block h-1 w-6 rounded-full"
                style={{ background: { clean: "#4e6b3d", dirty: "#a4563a", inspect: "#9a6512", maintenance: "#9b2c2c" }[r.housekeeping] }}
              />
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["clean", "dirty", "inspect", "maintenance"] as const).map((s) => (
            <span key={s} className="flex items-center gap-2 text-xs text-subtle">
              <HousekeepingBadge status={s} /> {byHk[s] ?? 0}
            </span>
          ))}
        </div>
      </Card>

      <p className="text-center text-xs text-subtle">
        {property.name} · Check-in de la {property.checkInTime} · Check-out până la {property.checkOutTime}
      </p>
    </div>
  );
}

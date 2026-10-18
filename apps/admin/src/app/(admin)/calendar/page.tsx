import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { seasonFor } from "@adonis/database";
import { prisma } from "@/lib/db";
import { addDays, isoDay, parseDay, today } from "@/lib/format";
import { PageHeader, sourceColor } from "@/components/ui";

export const metadata = { title: "Calendar" };

const DAYS = 21;
const wd = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "UTC" });
const mo = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function CalendarPage({ searchParams }: { searchParams: { start?: string } }) {
  const t = today();
  const start = searchParams.start ? parseDay(searchParams.start) : addDays(t, -2);
  const end = addDays(start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [rooms, reservations, overrides, seasons] = await Promise.all([
    prisma.room.findMany({ include: { roomType: true }, orderBy: { number: "asc" } }),
    prisma.reservation.findMany({
      where: { status: { notIn: ["cancelled", "no_show"] }, checkIn: { lt: end }, checkOut: { gt: start } },
      include: { guest: true },
    }),
    prisma.availabilityOverride.findMany({ where: { startDate: { lt: end }, endDate: { gt: start } } }),
    prisma.seasonRule.findMany(),
  ]);

  const col = (d: Date) => Math.round((d.getTime() - start.getTime()) / 86_400_000);
  const floors = Array.from(new Set(rooms.map((r) => r.floor)));
  const gridCols = `112px repeat(${DAYS}, minmax(44px, 1fr))`;

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Calendar" description={`${mo.format(start)} · ${rooms.length} camere. Apăsați pe o zi liberă ca să faceți o rezervare.`}>
        <Link href={`/calendar?start=${isoDay(addDays(start, -14))}`} className="btn-ghost" aria-label="Două săptămâni înapoi"><ChevronLeft size={16} /></Link>
        <Link href="/calendar" className="btn-ghost">Azi</Link>
        <Link href={`/calendar?start=${isoDay(addDays(start, 14))}`} className="btn-ghost" aria-label="Două săptămâni înainte"><ChevronRight size={16} /></Link>
        <Link href="/rezervari/noua" className="btn-primary"><Plus size={16} /> Rezervare</Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-subtle">
        {[["booking", "Booking.com"], ["airbnb", "Airbnb"], ["direct", "Direct"], ["phone", "Telefon"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm" style={{ background: sourceColor[k] }} />{l}</span>
        ))}
        <span className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm border border-dashed border-warning bg-warning-soft" />În așteptare</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm bg-[repeating-linear-gradient(45deg,#e6dccb_0_4px,transparent_4px_8px)]" />Indisponibilă</span>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Antet zile + sezon */}
          <div className="sticky top-0 z-10 grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
            <div className="px-3 py-2 label">Camera</div>
            {days.map((d) => {
              const isToday = d.getTime() === t.getTime();
              const weekend = [0, 6].includes(d.getUTCDay());
              const s = rooms[0] ? seasonFor(d, rooms[0].roomTypeId, seasons.filter((x) => x.roomTypeId === null)) : null;
              return (
                <div key={d.toISOString()} className={`border-l border-line/60 px-1 pb-1.5 pt-2 text-center ${weekend ? "bg-muted/60" : ""}`}>
                  <p className={`text-[0.625rem] uppercase ${isToday ? "text-gold-text" : "text-subtle"}`}>{wd.format(d).replace(".", "")}</p>
                  <p className={`num mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full font-display text-lg leading-none ${isToday ? "bg-primary text-primary-fg" : "text-heading"}`}>{d.getUTCDate()}</p>
                  <span className="mt-1 block h-0.5 rounded-full" style={{ background: s?.color ?? "transparent" }} title={s?.name} />
                </div>
              );
            })}
          </div>

          {floors.map((f) => (
            <div key={f}>
              <div className="border-b border-line bg-muted/50 px-3 py-1.5 label">{f === 0 ? "Parter · grădină" : `Etajul ${f}`}</div>
              {rooms.filter((r) => r.floor === f).map((room) => {
                const rs = reservations.filter((r) => r.roomId === room.id);
                const os = overrides.filter((o) => o.roomId === room.id);
                return (
                  <div key={room.id} className="relative grid h-12 border-b border-line/70" style={{ gridTemplateColumns: gridCols }}>
                    <div className="flex items-center gap-2 px-3">
                      <span className="num font-display text-xl text-heading">{room.number}</span>
                      <span className="text-[0.625rem] uppercase tracking-wider text-subtle">{room.roomType.code}</span>
                    </div>
                    {days.map((d) => (
                      <Link
                        key={d.toISOString()}
                        href={`/rezervari/noua?room=${room.id}&date=${isoDay(d)}`}
                        className={`border-l border-line/60 transition-colors hover:bg-gold-50 ${[0, 6].includes(d.getUTCDay()) ? "bg-muted/40" : ""}`}
                        aria-label={`Rezervă camera ${room.number} pe ${isoDay(d)}`}
                      />
                    ))}
                    {os.map((o) => {
                      const a = Math.max(0, col(o.startDate));
                      const b = Math.min(DAYS, col(o.endDate));
                      return (
                        <div
                          key={o.id}
                          className="pointer-events-none absolute top-1.5 bottom-1.5 flex items-center rounded-sm bg-[repeating-linear-gradient(45deg,#e6dccb_0_6px,#f2ede3_6px_12px)] px-2 text-[0.6875rem] text-subtle"
                          style={{ gridRow: 1, left: `calc(112px + (100% - 112px) * ${a / DAYS})`, width: `calc((100% - 112px) * ${(b - a) / DAYS})` }}
                        >
                          {o.note ?? "Indisponibilă"}
                        </div>
                      );
                    })}
                    {rs.map((r) => {
                      const a = col(r.checkIn);
                      const b = col(r.checkOut);
                      const ca = Math.max(0, a);
                      const cb = Math.min(DAYS, b);
                      const pending = r.status === "pending";
                      // barele încep la jumătatea zilei de sosire și se termină la jumătatea zilei de plecare
                      const left = `calc(112px + (100% - 112px) * ${(ca + (a >= 0 ? 0.5 : 0)) / DAYS} + 1px)`;
                      const width = `calc((100% - 112px) * ${(cb - ca - (a >= 0 ? 0.5 : 0) + (b <= DAYS ? 0.5 : 0)) / DAYS} - 2px)`;
                      return (
                        <Link
                          key={r.id}
                          href={`/rezervari/${r.id}`}
                          className={`absolute top-1.5 bottom-1.5 flex items-center overflow-hidden whitespace-nowrap rounded-sm px-2 text-xs shadow-hairline transition-transform hover:-translate-y-px ${pending ? "border border-dashed border-warning bg-warning-soft text-warning" : "text-ivory-25"}`}
                          style={{ left, width, background: pending ? undefined : sourceColor[r.source] }}
                          title={`${r.guest.firstName} ${r.guest.lastName} · ${r.code}`}
                        >
                          {r.status === "checked_in" && <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-300" />}
                          <span className="truncate">{r.guest.lastName} {r.guest.firstName[0]}.</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-subtle">Punctul auriu marchează oaspeții cazați acum. Linia colorată de sub dată arată sezonul tarifar.</p>
    </div>
  );
}

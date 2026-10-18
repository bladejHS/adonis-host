import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { seasonFor } from "@adonis/database/pricing";
import { PageHeader, sourceColor } from "@/components/ui";
import { useDb } from "../data/store";
import { addDays, isoDay, parseDay, today } from "../lib";

const DAYS = 21;
const wd = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "UTC" });
const mo = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });

export function CalendarPage() {
  const db = useDb();
  const [sp] = useSearchParams();
  const t = today();
  const start = sp.get("start") ? parseDay(sp.get("start")!) : addDays(t, -2);
  const end = addDays(start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const reservations = db.reservations.filter((r) => !["cancelled", "no_show"].includes(r.status) && r.checkIn < end && r.checkOut > start);
  const overrides = db.overrides.filter((o) => o.startDate < end && o.endDate > start);
  const globalSeasons = db.seasons.filter((s) => s.roomTypeId === null);
  const col = (d: Date) => Math.round((d.getTime() - start.getTime()) / 86_400_000);
  const floors = Array.from(new Set(db.rooms.map((r) => r.floor)));
  const gridCols = `112px repeat(${DAYS}, minmax(44px, 1fr))`;
  const guest = new Map(db.guests.map((g) => [g.id, g]));
  const type = new Map(db.roomTypes.map((x) => [x.id, x]));

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Calendar" description={`${mo.format(start)} · ${db.rooms.length} camere. Apăsați pe o zi liberă ca să faceți o rezervare.`}>
        <Link to={`/calendar?start=${isoDay(addDays(start, -14))}`} className="btn-ghost" aria-label="Două săptămâni înapoi"><ChevronLeft size={16} /></Link>
        <Link to="/calendar" className="btn-ghost">Azi</Link>
        <Link to={`/calendar?start=${isoDay(addDays(start, 14))}`} className="btn-ghost" aria-label="Două săptămâni înainte"><ChevronRight size={16} /></Link>
        <Link to="/rezervari/noua" className="btn-primary"><Plus size={16} /> Rezervare</Link>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-subtle">
        {[["booking", "Booking.com"], ["airbnb", "Airbnb"], ["direct", "Direct"], ["phone", "Telefon"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm" style={{ background: sourceColor[k] }} />{l}</span>
        ))}
        <span className="flex items-center gap-2"><span className="h-2.5 w-5 rounded-sm border border-dashed border-warning bg-warning-soft" />În așteptare</span>
      </div>
      <div className="card overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="sticky top-0 z-10 grid border-b border-line bg-surface" style={{ gridTemplateColumns: gridCols }}>
            <div className="label px-3 py-2">Camera</div>
            {days.map((d) => {
              const isToday = d.getTime() === t.getTime();
              const weekend = [0, 6].includes(d.getUTCDay());
              const s = db.rooms[0] ? seasonFor(d, db.rooms[0].roomTypeId, globalSeasons) : null;
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
              <div className="label border-b border-line bg-muted/50 px-3 py-1.5">{f === 0 ? "Parter · grădină" : `Etajul ${f}`}</div>
              {db.rooms.filter((r) => r.floor === f).map((room) => (
                <div key={room.id} className="relative grid h-12 border-b border-line/70" style={{ gridTemplateColumns: gridCols }}>
                  <div className="flex items-center gap-2 px-3">
                    <span className="num font-display text-xl text-heading">{room.number}</span>
                    <span className="text-[0.625rem] uppercase tracking-wider text-subtle">{type.get(room.roomTypeId)!.code}</span>
                  </div>
                  {days.map((d) => (
                    <Link key={d.toISOString()} to={`/rezervari/noua?room=${room.id}&date=${isoDay(d)}`} className={`border-l border-line/60 transition-colors hover:bg-gold-50 ${[0, 6].includes(d.getUTCDay()) ? "bg-muted/40" : ""}`} aria-label={`Rezervă camera ${room.number} pe ${isoDay(d)}`} />
                  ))}
                  {overrides.filter((o) => o.roomId === room.id).map((o) => {
                    const a = Math.max(0, col(o.startDate));
                    const b = Math.min(DAYS, col(o.endDate));
                    return <div key={o.id} className="pointer-events-none absolute bottom-1.5 top-1.5 flex items-center rounded-sm bg-[repeating-linear-gradient(45deg,#e6dccb_0_6px,#f2ede3_6px_12px)] px-2 text-[0.6875rem] text-subtle" style={{ left: `calc(112px + (100% - 112px) * ${a / DAYS})`, width: `calc((100% - 112px) * ${(b - a) / DAYS})` }}>{o.note ?? "Indisponibilă"}</div>;
                  })}
                  {reservations.filter((r) => r.roomId === room.id).map((r) => {
                    const a = col(r.checkIn);
                    const b = col(r.checkOut);
                    const ca = Math.max(0, a);
                    const cb = Math.min(DAYS, b);
                    const pending = r.status === "pending";
                    const g = guest.get(r.guestId)!;
                    return (
                      <Link
                        key={r.id}
                        to={`/rezervari/${r.id}`}
                        className={`absolute bottom-1.5 top-1.5 flex items-center overflow-hidden whitespace-nowrap rounded-sm px-2 text-xs shadow-hairline transition-transform hover:-translate-y-px ${pending ? "border border-dashed border-warning bg-warning-soft text-warning" : "text-ivory-25"}`}
                        style={{ left: `calc(112px + (100% - 112px) * ${(ca + (a >= 0 ? 0.5 : 0)) / DAYS} + 1px)`, width: `calc((100% - 112px) * ${(cb - ca - (a >= 0 ? 0.5 : 0) + (b <= DAYS ? 0.5 : 0)) / DAYS} - 2px)`, background: pending ? undefined : sourceColor[r.source] }}
                        title={`${g.firstName} ${g.lastName} · ${r.code}`}
                      >
                        {r.status === "checked_in" && <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-300" />}
                        <span className="truncate">{g.lastName} {g.firstName[0]}.</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-subtle">Punctul auriu marchează oaspeții cazați acum. Linia colorată de sub dată arată sezonul tarifar.</p>
    </div>
  );
}

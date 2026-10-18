import { Link } from "react-router-dom";
import { AMENITY, HOUSEKEEPING, SEA_VIEW } from "@adonis/database/enums";
import { HousekeepingBadge, PageHeader } from "@/components/ui";
import { asset, useDb } from "../data/store";
import { setRoomHk } from "../data/actions";
import { fmtShort, json, lei, today } from "../lib";

const photoFor = (code: string, floor: number) =>
  code === "DVM" ? (floor === 3 ? "/photos/room-sea-double-2.webp" : "/photos/room-sea-double.webp") : code === "DVL" ? "/photos/room-sea-3.webp" : code === "CVD" ? "/photos/room-quad.webp" : code === "TRP" ? "/photos/room-triple.webp" : "/photos/room-garden.webp";

export function Rooms() {
  const db = useDb();
  const t = today();
  const floors = Array.from(new Set(db.rooms.map((r) => r.floor)));
  const type = new Map(db.roomTypes.map((x) => [x.id, x]));
  const capacity = db.rooms.reduce((s, r) => s + type.get(r.roomTypeId)!.capacity, 0);
  const guest = new Map(db.guests.map((g) => [g.id, g]));

  return (
    <div>
      <PageHeader eyebrow="Casă" title="Camere" description={`${db.rooms.length} camere, ${capacity} de locuri. Toate au baie proprie, aer condiționat Daikin, frigider, TV, seif și Wi-Fi.`} />
      <div className="space-y-10">
        {floors.map((f) => (
          <section key={f} className="space-y-4">
            <div className="flex items-center gap-4"><h2 className="text-2xl">{f === 0 ? "Parter" : `Etajul ${f}`}</h2><span className="rule-gold flex-1" /></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {db.rooms.filter((r) => r.floor === f).map((r) => {
                const ty = type.get(r.roomTypeId)!;
                const upcoming = db.reservations.filter((x) => x.roomId === r.id && ["checked_in", "confirmed", "pending"].includes(x.status) && x.checkOut > t).sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
                const current = upcoming.find((x) => x.status === "checked_in");
                const next = upcoming.find((x) => x.status !== "checked_in");
                const amen = json<string[]>(r.amenities, []);
                return (
                  <article key={r.id} className="card overflow-hidden">
                    <div className="relative h-40">
                      <img src={asset(photoFor(ty.code, r.floor))} alt={`Camera ${r.number}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/10 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-ivory-25">
                        <div><p className="num font-display text-4xl leading-none">{r.number}</p><p className="text-xs text-navy-200">{ty.name}</p></div>
                        <p className="num text-right text-xs text-gold-300">de la {lei(ty.baseRate)}<br />/ noapte</p>
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><HousekeepingBadge status={r.housekeeping} /><span className="text-xs text-subtle">{SEA_VIEW[r.seaView as keyof typeof SEA_VIEW]}{r.hasBalcony ? " · balcon" : ""}</span></div>
                      <p className="text-sm">
                        {current ? <>Cazat: <Link to={`/rezervari/${current.id}`} className="text-heading hover:text-gold-text">{guest.get(current.guestId)!.firstName} {guest.get(current.guestId)!.lastName}</Link> <span className="text-subtle">până pe {fmtShort(current.checkOut)}</span></>
                          : next ? <>Următorul: <Link to={`/rezervari/${next.id}`} className="text-heading hover:text-gold-text">{guest.get(next.guestId)!.lastName}</Link> <span className="text-subtle">din {fmtShort(next.checkIn)}</span></>
                          : <span className="text-subtle">Liberă, fără rezervări viitoare</span>}
                      </p>
                      {r.notes && <p className="text-xs text-error">{r.notes}</p>}
                      <p className="text-xs text-subtle">{r.bedSetup} · {amen.map((a) => AMENITY[a as keyof typeof AMENITY]).filter(Boolean).slice(0, 3).join(", ")}</p>
                      <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                        {Object.entries(HOUSEKEEPING).filter(([k]) => k !== r.housekeeping).map(([k, v]) => (
                          <button key={k} onClick={() => setRoomHk(r.id, k)} className="rounded-full border border-line px-2.5 py-1 text-[0.6875rem] text-subtle transition-colors hover:border-gold hover:text-heading">{v}</button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

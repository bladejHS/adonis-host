import Link from "next/link";
import { AMENITY, HOUSEKEEPING, SEA_VIEW } from "@adonis/database";
import { prisma } from "@/lib/db";
import { fmtShort, json, lei, today } from "@/lib/format";
import { setRoomHousekeeping } from "@/lib/actions";
import { HousekeepingBadge, PageHeader } from "@/components/ui";

export const metadata = { title: "Camere" };

const photoFor = (code: string, floor: number) =>
  code === "DVM" ? (floor === 3 ? "/photos/room-sea-double-2.webp" : "/photos/room-sea-double.webp") : code === "DVL" ? "/photos/room-sea-3.webp" : code === "CVD" ? "/photos/room-quad.webp" : code === "TRP" ? "/photos/room-triple.webp" : "/photos/room-garden.webp";

export default async function Rooms() {
  const t = today();
  const rooms = await prisma.room.findMany({
    include: {
      roomType: true,
      reservations: { where: { status: { in: ["checked_in", "confirmed", "pending"] }, checkOut: { gt: t } }, include: { guest: true }, orderBy: { checkIn: "asc" }, take: 2 },
    },
    orderBy: { number: "asc" },
  });
  const floors = Array.from(new Set(rooms.map((r) => r.floor)));
  const capacity = rooms.reduce((s, r) => s + r.roomType.capacity, 0);

  return (
    <div>
      <PageHeader eyebrow="Casă" title="Camere" description={`${rooms.length} camere, ${capacity} de locuri. Toate au baie proprie, aer condiționat Daikin, frigider, TV, seif și Wi-Fi.`} />
      <div className="space-y-10">
        {floors.map((f) => (
          <section key={f} className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl">{f === 0 ? "Parter" : `Etajul ${f}`}</h2>
              <span className="rule-gold flex-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.filter((r) => r.floor === f).map((r) => {
                const current = r.reservations.find((x) => x.status === "checked_in");
                const next = r.reservations.find((x) => x.status !== "checked_in");
                const amen = json<string[]>(r.amenities, []);
                return (
                  <article key={r.id} className="card overflow-hidden">
                    <div className="relative h-40">
                      <img src={photoFor(r.roomType.code, r.floor)} alt={`Camera ${r.number}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/10 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-ivory-25">
                        <div>
                          <p className="num font-display text-4xl leading-none">{r.number}</p>
                          <p className="text-xs text-navy-200">{r.roomType.name}</p>
                        </div>
                        <p className="num text-right text-xs text-gold-300">de la {lei(r.roomType.baseRate)}<br />/ noapte</p>
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <HousekeepingBadge status={r.housekeeping} />
                        <span className="text-xs text-subtle">{SEA_VIEW[r.seaView as keyof typeof SEA_VIEW]}{r.hasBalcony ? " · balcon" : ""}</span>
                      </div>
                      <p className="text-sm">
                        {current ? (
                          <>Cazat: <Link href={`/rezervari/${current.id}`} className="text-heading hover:text-gold-text">{current.guest.firstName} {current.guest.lastName}</Link> <span className="text-subtle">până pe {fmtShort(current.checkOut)}</span></>
                        ) : next ? (
                          <>Următorul: <Link href={`/rezervari/${next.id}`} className="text-heading hover:text-gold-text">{next.guest.lastName}</Link> <span className="text-subtle">din {fmtShort(next.checkIn)}</span></>
                        ) : (
                          <span className="text-subtle">Liberă, fără rezervări viitoare</span>
                        )}
                      </p>
                      {r.notes && <p className="text-xs text-error">{r.notes}</p>}
                      <p className="text-xs text-subtle">{r.bedSetup} · {amen.map((a) => AMENITY[a as keyof typeof AMENITY]).filter(Boolean).slice(0, 3).join(", ")}</p>
                      <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                        {Object.entries(HOUSEKEEPING).filter(([k]) => k !== r.housekeeping).map(([k, v]) => (
                          <form key={k} action={setRoomHousekeeping.bind(null, r.id, k)}>
                            <button className="rounded-full border border-line px-2.5 py-1 text-[0.6875rem] text-subtle transition-colors hover:border-gold hover:text-heading">{v}</button>
                          </form>
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

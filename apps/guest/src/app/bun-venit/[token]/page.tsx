import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Car, Clock, KeyRound, MapPin, Sun, Umbrella, Wifi } from "lucide-react";
import { findByToken } from "@adonis/core";
import { prisma, nightsBetween } from "@adonis/database";
import { Footer, Hero, Panel } from "@/components/shell";
import { fmtDay, sunriseCostinesti } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bun venit" };

export default async function Welcome({ params, searchParams }: { params: { token: string }; searchParams: { gata?: string } }) {
  const r = await findByToken(params.token);
  if (!r) notFound();
  const p = r.room.property;
  const photos = await prisma.mediaAsset.findMany({ where: { entityType: { in: ["property", "room_type"] } }, orderBy: { sortOrder: "asc" } });
  const code = r.accessCodes[0];
  const hero = r.room.seaView === "full" ? "/photos/room-sea-double.webp" : "/photos/sea-balcony.webp";

  return (
    <main>
      <Hero photo={hero} eyebrow={searchParams.gata ? "Check-in completat" : `Camera ${r.room.number}`} title={<>Vă așteptăm cu drag, <em className="font-normal text-gold-300">{r.guest.firstName}</em></>}>
        <p>{searchParams.gata ? "Mulțumim! La sosire, recepția vă dă cheia direct, fără formulare." : `${r.room.roomType.name} · ${nightsBetween(r.checkIn, r.checkOut)} nopți`}</p>
      </Hero>

      <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
        <Panel className="grid grid-cols-2 gap-5">
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><CalendarDays size={13} className="text-gold" /> Sosire</p><p className="font-display text-xl text-heading">{fmtDay(r.checkIn)}</p><p className="text-xs text-subtle">de la ora {p.checkInTime}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><Clock size={13} className="text-gold" /> Plecare</p><p className="font-display text-xl text-heading">{fmtDay(r.checkOut)}</p><p className="text-xs text-subtle">până la ora {p.checkOutTime}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><Wifi size={13} className="text-gold" /> Wi-Fi</p><p className="num text-heading">{p.wifiName}</p><p className="num text-xs text-subtle">parola: {p.wifiPassword}</p></div>
          <div className="space-y-1"><p className="label flex items-center gap-1.5"><KeyRound size={13} className="text-gold" /> Acces</p>{code ? <p className="num font-display text-2xl tracking-widest text-heading">{code.code}</p> : <p className="text-sm text-heading">Cheia la recepție</p>}<p className="text-xs text-subtle">recepție 24/24</p></div>
        </Panel>

        <section className="flex items-center gap-4 rounded bg-navy-900 p-5 text-ivory-50 shadow-hairline">
          <Sun size={30} strokeWidth={1.2} className="shrink-0 text-gold-300" />
          <p className="text-sm text-navy-100">
            Răsăritul în prima dimineață: <span className="font-display text-xl text-gold-300">~{sunriseCostinesti(new Date(r.checkIn.getTime() + 86_400_000))}</span>
            {r.room.seaView !== "none" ? " — se vede direct din pat sau de pe balcon." : " — la doar 35 de metri, pe plajă."}
          </p>
        </section>

        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
          {photos.map((m) => (
            <figure key={m.id} className="w-56 shrink-0 snap-start space-y-1.5">
              <img src={m.path} alt={m.altText} className="h-72 w-56 rounded-arch object-cover" />
              <figcaption className="text-xs text-subtle">{m.altText}</figcaption>
            </figure>
          ))}
        </div>

        <Panel className="space-y-3 text-sm">
          <h2 className="text-2xl">Bine de știut</h2>
          <p className="flex gap-3"><Car size={18} className="mt-0.5 shrink-0 text-gold" /> Parcarea din curte e gratuită. Mașinile electrice se pot încărca gratuit, ziua, la stația de la stradă.</p>
          <p className="flex gap-3"><Umbrella size={18} className="mt-0.5 shrink-0 text-gold" /> Umbrele de plajă, uscător de păr și fier de călcat primiți gratuit la cerere.</p>
          <p className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-gold" /> Centrul stațiunii e la 10–15 minute de plimbare pe faleză. Grătarul și plita mare din curte sunt la dispoziția tuturor.</p>
        </Panel>

        <Link href={`/oferte/${params.token}`} className="block overflow-hidden rounded border border-gold/40 bg-gold-soft">
          <div className="flex items-center gap-4 p-5">
            <img src="/photos/courtyard-vine.webp" alt="" className="h-16 w-16 rounded-full object-cover" />
            <div className="flex-1">
              <p className="font-display text-xl text-heading">Mici bucurii pentru sejur</p>
              <p className="text-sm text-gold-text">Upgrade cu vedere la mare, seară la grătar, barca la răsărit →</p>
            </div>
          </div>
        </Link>
        {!r.checkinDoneAt && (
          <Link href={`/checkin/${params.token}`} className="btn-primary w-full py-3 text-base">Completează check-in-ul online</Link>
        )}
      </div>
      <Footer />
    </main>
  );
}

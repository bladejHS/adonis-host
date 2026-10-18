import Link from "next/link";
import { prisma } from "@adonis/database";
import { Footer, Hero, Panel } from "@/components/shell";
import { lei } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mulțumim" };

export default async function Thanks({ searchParams }: { searchParams: { link?: string } }) {
  const link = searchParams.link ? await prisma.paymentLink.findUnique({ where: { id: searchParams.link }, include: { reservation: true, purchases: { include: { offer: true } } } }) : null;
  return (
    <main>
      <Hero photo="/photos/sea-balcony.webp" eyebrow={link?.status === "paid" ? "Plată confirmată" : "Plata se procesează"} title={<>Mulțumim <em className="font-normal text-gold-300">din suflet</em></>}>
        <p>{link?.status === "paid" ? "Am primit plata. Totul va fi pregătit pentru sosirea dumneavoastră." : "Confirmarea de la bancă poate dura câteva minute. Vă anunțăm imediat ce o primim."}</p>
      </Hero>
      <div className="mx-auto max-w-xl space-y-5 px-5 py-8">
        {link && (
          <Panel className="space-y-2 text-sm">
            {link.purchases.map((p) => (
              <p key={p.id} className="flex justify-between gap-3"><span>{p.offer.title}</span><span className="num">{lei(p.amount * p.quantity)}</span></p>
            ))}
            <div className="rule-gold my-2" />
            <p className="flex justify-between font-display text-xl text-heading"><span>Total</span><span className="num">{lei(link.amount)}</span></p>
          </Panel>
        )}
        {link && <Link href={`/bun-venit/${link.reservation.checkinToken}`} className="btn-ghost w-full py-3">Înapoi la sejurul meu</Link>}
      </div>
      <Footer />
    </main>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@adonis/database";
import { confirmDemoPayment } from "@/lib/actions";
import { Footer, Panel } from "@/components/shell";
import { lei } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plată demo" };

/** Pagina apare doar când Stripe și Netopia nu sunt configurate (dezvoltare, demonstrații). */
export default async function DemoPayment({ params }: { params: { id: string } }) {
  const link = await prisma.paymentLink.findUnique({ where: { id: params.id }, include: { purchases: { include: { offer: true } }, reservation: true } });
  if (!link || link.provider !== "demo") notFound();
  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-10">
      <img src="/brand/adonis-logo-horizontal.svg" alt="Hostel Adonis" className="mx-auto h-12" />
      <Panel className="space-y-4">
        <p className="label text-warning">Mod demonstrativ · nu se încasează bani</p>
        <h1 className="text-3xl">Plată {link.reservation.code}</h1>
        <ul className="space-y-1 text-sm">
          {link.purchases.map((p) => (
            <li key={p.id} className="flex justify-between gap-3"><span>{p.offer.title}</span><span className="num">{lei(p.amount * p.quantity)}</span></li>
          ))}
        </ul>
        <div className="rule-gold" />
        <p className="flex justify-between font-display text-2xl text-heading"><span>Total</span><span className="num">{lei(link.amount)}</span></p>
        {link.status === "paid" ? (
          <p className="text-success">Plata a fost deja înregistrată.</p>
        ) : (
          <form action={confirmDemoPayment.bind(null, link.id)}>
            <button className="btn-primary w-full py-3 text-base">Simulează plata reușită</button>
          </form>
        )}
        <p className="text-xs text-subtle">În producție, aici se deschide pagina securizată Stripe sau Netopia.</p>
      </Panel>
      <Footer />
    </main>
  );
}

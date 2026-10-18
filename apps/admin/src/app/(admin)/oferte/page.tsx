import { UPSELL_CATEGORY } from "@adonis/database";
import { prisma } from "@/lib/db";
import { json, lei, pct } from "@/lib/format";
import { createOffer, toggleOffer } from "@/lib/actions";
import { Card, Field, PageHeader, Stat } from "@/components/ui";
import { Submit } from "@/components/submit";

export const metadata = { title: "Oferte extra" };

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const UNIT: Record<string, string> = { per_stay: "/ sejur", per_night: "/ noapte", per_person: "/ persoană" };

export default async function Offers() {
  const [offers, stays] = await Promise.all([
    prisma.upsellOffer.findMany({ include: { purchases: true }, orderBy: { sortOrder: "asc" } }),
    prisma.reservation.count({ where: { status: { in: ["checked_out", "checked_in", "confirmed"] } } }),
  ]);
  const paid = offers.flatMap((o) => o.purchases.filter((p) => p.status === "paid"));
  const revenue = paid.reduce((s, p) => s + p.amount * p.quantity, 0);
  const withExtra = new Set(offers.flatMap((o) => o.purchases.filter((p) => p.status !== "cancelled").map((p) => p.reservationId))).size;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Casă" title="Oferte extra" description="Micile bucurii care fac sejurul memorabil și aduc venit în plus. Oaspeții le primesc în mesajul dinaintea sosirii." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Venit din extra" value={lei(revenue)} tone="gold" />
        <Stat label="Comenzi plătite" value={paid.length} />
        <Stat label="Rata de conversie" value={pct(stays ? withExtra / stays : 0)} hint="sejururi cu cel puțin un extra" />
        <Stat label="Oferte active" value={offers.filter((o) => o.active).length} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {offers.map((o) => {
          const rules = json<{ months?: number[] }>(o.seasonalRules, {});
          const sold = o.purchases.filter((p) => p.status === "paid");
          return (
            <article key={o.id} className={`card flex flex-col overflow-hidden ${o.active ? "" : "opacity-60"}`}>
              {o.imagePath ? (
                <img src={o.imagePath} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center bg-navy-900"><img src="/brand/adonis-mark-on-dark.svg" alt="" className="h-14 opacity-80" /></div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="label text-gold-text">{UPSELL_CATEGORY[o.category as keyof typeof UPSELL_CATEGORY]}</p>
                <h3 className="text-xl leading-tight">{o.title}</h3>
                <p className="flex-1 text-sm text-subtle">{o.description}</p>
                <p className="num font-display text-2xl text-heading">{lei(o.price)} <span className="font-sans text-xs text-subtle">{UNIT[o.unit]}</span></p>
                <p className="text-xs text-subtle">
                  {rules.months?.length ? `Disponibil: ${rules.months.map((m) => MONTHS[m - 1]).join(", ")}` : "Disponibil tot anul"} · {sold.length} vândute
                </p>
                <form action={toggleOffer.bind(null, o.id, !o.active)} className="pt-2">
                  <button className="btn-ghost btn-sm">{o.active ? "Dezactivează" : "Activează"}</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      <Card title="Ofertă nouă">
        <form action={createOffer} className="grid gap-4 md:grid-cols-2">
          <Field label="Titlu"><input name="title" required className="field" placeholder="Ex: Mic dejun pe balcon" /></Field>
          <Field label="Categorie">
            <select name="category" className="field">
              {Object.entries(UPSELL_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Descriere" className="md:col-span-2"><textarea name="description" rows={2} className="field" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preț (lei)"><input name="price" type="number" step="1" min="0" required className="field" /></Field>
            <Field label="Unitate">
              <select name="unit" className="field">
                <option value="per_stay">pe sejur</option>
                <option value="per_night">pe noapte</option>
                <option value="per_person">pe persoană</option>
              </select>
            </Field>
          </div>
          <Field label="Luni disponibile" hint="Numere separate prin virgulă, ex: 6,7,8. Gol = tot anul."><input name="months" className="field" /></Field>
          <div className="md:col-span-2"><Submit>Adaugă oferta</Submit></div>
        </form>
        <p className="mt-4 text-xs text-subtle">Linkurile de plată (Stripe, Netopia) și pagina de oferte pentru oaspeți se activează în Faza 4.</p>
      </Card>
    </div>
  );
}

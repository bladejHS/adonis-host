import { useState } from "react";
import { UPSELL_CATEGORY } from "@adonis/database/enums";
import { Card, Field, PageHeader, Stat } from "@/components/ui";
import { asset, useDb } from "../data/store";
import { createOffer, toggleOffer } from "../data/actions";
import { json, lei, pct } from "../lib";

const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const UNIT: Record<string, string> = { per_stay: "/ sejur", per_night: "/ noapte", per_person: "/ persoană" };

export function Offers() {
  const db = useDb();
  const paid = db.purchases.filter((p) => p.status === "paid");
  const revenue = paid.reduce((s, p) => s + p.amount * p.quantity, 0);
  const stays = db.reservations.filter((r) => ["checked_out", "checked_in", "confirmed"].includes(r.status)).length;
  const withExtra = new Set(db.purchases.filter((p) => p.status !== "cancelled").map((p) => p.reservationId)).size;
  const funnel = (id: string) => ({
    view: db.upsellEvents.filter((e) => e.offerId === id && e.kind === "view").length,
    click: db.upsellEvents.filter((e) => e.offerId === id && e.kind === "click").length,
    purchase: db.upsellEvents.filter((e) => e.offerId === id && e.kind === "purchase").length,
  });
  const [f, setF] = useState({ title: "", description: "", category: "experience", price: "", unit: "per_stay", months: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Casă" title="Oferte extra" description="Micile bucurii care fac sejurul memorabil și aduc venit în plus. Oaspeții le primesc în mesajul dinaintea sosirii." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Venit din extra" value={lei(revenue)} tone="gold" />
        <Stat label="Comenzi plătite" value={paid.length} />
        <Stat label="Rata de conversie" value={pct(stays ? withExtra / stays : 0)} hint="sejururi cu cel puțin un extra" />
        <Stat label="Oferte active" value={db.offers.filter((o) => o.active).length} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {db.offers.map((o) => {
          const rules = json<{ months?: number[] }>(o.seasonalRules, {});
          const fn = funnel(o.id);
          return (
            <article key={o.id} className={`card flex flex-col overflow-hidden ${o.active ? "" : "opacity-60"}`}>
              {o.imagePath ? <img src={asset(o.imagePath)} alt="" className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-navy-900"><img src={asset("/brand/adonis-mark-on-dark.svg")} alt="" className="h-14 opacity-80" /></div>}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="label text-gold-text">{UPSELL_CATEGORY[o.category as keyof typeof UPSELL_CATEGORY]}</p>
                <h3 className="text-xl leading-tight">{o.title}</h3>
                <p className="flex-1 text-sm text-subtle">{o.description}</p>
                <p className="num font-display text-2xl text-heading">{lei(o.price)} <span className="font-sans text-xs text-subtle">{UNIT[o.unit]}</span></p>
                <p className="num text-xs text-subtle">{fn.view} afișări · {fn.click} clicuri · {fn.purchase} cumpărări{fn.view > 0 && <span className="text-gold-text"> · {((fn.purchase / fn.view) * 100).toFixed(1)}% conversie</span>}</p>
                <p className="text-xs text-subtle">{rules.months?.length ? `Disponibil: ${rules.months.map((m) => MONTHS[m - 1]).join(", ")}` : "Disponibil tot anul"}</p>
                <div className="pt-2"><button className="btn-ghost btn-sm" onClick={() => toggleOffer(o.id)}>{o.active ? "Dezactivează" : "Activează"}</button></div>
              </div>
            </article>
          );
        })}
      </div>
      <Card title="Ofertă nouă">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createOffer({ ...f, price: Number(f.price), months: f.months.split(",").map((m) => Number(m.trim())).filter((m) => m >= 1 && m <= 12) });
            setF({ title: "", description: "", category: "experience", price: "", unit: "per_stay", months: "" });
          }}
        >
          <Field label="Titlu"><input id="o-title" required value={f.title} onChange={(e) => set("title", e.target.value)} className="field" placeholder="Ex: Mic dejun pe balcon" /></Field>
          <Field label="Categorie"><select id="o-cat" value={f.category} onChange={(e) => set("category", e.target.value)} className="field">{Object.entries(UPSELL_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Descriere" className="md:col-span-2"><textarea id="o-desc" required rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className="field" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preț (lei)"><input id="o-price" type="number" min="0" required value={f.price} onChange={(e) => set("price", e.target.value)} className="field" /></Field>
            <Field label="Unitate"><select id="o-unit" value={f.unit} onChange={(e) => set("unit", e.target.value)} className="field"><option value="per_stay">pe sejur</option><option value="per_night">pe noapte</option><option value="per_person">pe persoană</option></select></Field>
          </div>
          <Field label="Luni disponibile" hint="Numere separate prin virgulă, ex: 6,7,8. Gol = tot anul."><input id="o-months" value={f.months} onChange={(e) => set("months", e.target.value)} className="field" /></Field>
          <div className="md:col-span-2"><button className="btn-primary">Adaugă oferta</button></div>
        </form>
      </Card>
    </div>
  );
}

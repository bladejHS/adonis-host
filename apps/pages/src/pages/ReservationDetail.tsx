import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, MessageCircle } from "lucide-react";
import { PAYMENT_METHOD, SEA_VIEW, UPSELL_CATEGORY } from "@adonis/database/enums";
import { nightsBetween } from "@adonis/database/pricing";
import { renderTemplate, type TemplateVars } from "@adonis/core/pure";
import { Card, Field, Notice, SourceTag, StatusBadge } from "@/components/ui";
import { asset, kvGet, useDb } from "../data/store";
import { addPayment, addPurchase, balanceOf, createPaymentLink, issueInvoice, setPurchaseStatus, setStatus, updateReservation } from "../data/actions";
import { Empty, fmtDateTime, fmtLong, isoDay, json, lei, parseDay } from "../lib";

function StoredImage({ k, alt, className }: { k: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => void kvGet<string>(k).then(setSrc), [k]);
  return src ? <img src={src} alt={alt} className={className} /> : null;
}

export function ReservationDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const db = useDb();
  const r = db.reservations.find((x) => x.id === id);
  if (!r) return <Empty title="Rezervarea nu există" />;
  const guest = db.guests.find((g) => g.id === r.guestId)!;
  const room = db.rooms.find((x) => x.id === r.roomId)!;
  const type = db.roomTypes.find((t) => t.id === room.roomTypeId)!;
  const p = db.property;
  const payments = db.payments.filter((x) => x.reservationId === r.id).sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  const purchases = db.purchases.filter((x) => x.reservationId === r.id);
  const invoices = db.invoices.filter((x) => x.reservationId === r.id);
  const links = db.paymentLinks.filter((x) => x.reservationId === r.id);
  const checkin = db.checkins.find((c) => c.reservationId === r.id);
  const stays = db.reservations.filter((x) => x.guestId === guest.id).length;
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const { extras, grand, due } = balanceOf(db, r);
  const tags = json<string[]>(guest.tags, []);
  const guestLink = `${location.origin}${location.pathname}#/oaspete/${r.checkinToken}`;
  const vars: TemplateVars = {
    guest_name: guest.firstName, guest_full_name: `${guest.firstName} ${guest.lastName}`, reservation_code: r.code, check_in_date: fmtLong(r.checkIn),
    check_out_date: fmtLong(r.checkOut), check_in_time: p.checkInTime, check_out_time: p.checkOutTime, room_number: room.number, room_type: type.name,
    nights: String(nights), total: lei(grand), balance: lei(Math.max(0, due)), wifi_name: p.wifiName ?? "", wifi_password: p.wifiPassword ?? "",
    checkin_link: `${guestLink}/checkin`, next_year: String(r.checkIn.getUTCFullYear() + 1),
  };
  const phone = (guest.phone ?? "").replace(/\D/g, "").replace(/^0/, "40");
  const photo = room.seaView === "full" ? "/photos/room-sea-double.webp" : room.floor === 0 ? "/photos/room-garden.webp" : type.capacity > 2 ? "/photos/room-quad.webp" : "/photos/room-sea-3.webp";

  return (
    <div className="space-y-8">
      <Link to="/rezervari" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-heading"><ArrowLeft size={15} /> Toate rezervările</Link>
      {sp.get("nou") && <Notice tone="success" title="Rezervarea a fost salvată">Codul {r.code} poate fi trimis oaspetelui. Mai jos găsiți mesajul de confirmare gata scris.</Notice>}
      {r.notes?.includes("Suprapunere") && <Notice tone="error" title="Suprapunere de rezervări">{r.notes}</Notice>}

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="label text-gold-text">{r.code}</p>
          <h1 className="text-[2.6rem] leading-none">{guest.firstName} {guest.lastName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
            <StatusBadge status={r.status} /><SourceTag source={r.source} /><span>Creată pe {fmtLong(r.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === "pending" && <button className="btn-primary" onClick={() => setStatus(r.id, "confirmed")}>Confirmă</button>}
          {["pending", "confirmed"].includes(r.status) && <button className="btn-gold" onClick={() => setStatus(r.id, "checked_in")}>Check-in</button>}
          {r.status === "checked_in" && <button className="btn-gold" onClick={() => setStatus(r.id, "checked_out")}>Check-out</button>}
          {["pending", "confirmed"].includes(r.status) && (
            <>
              <button className="btn-ghost" onClick={() => setStatus(r.id, "no_show")}>Neprezentat</button>
              <button className="btn-danger" onClick={() => setStatus(r.id, "cancelled")}>Anulează</button>
            </>
          )}
          {["cancelled", "no_show"].includes(r.status) && <button className="btn-ghost" onClick={() => setStatus(r.id, "confirmed")}>Reactivează</button>}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <section className="card grid overflow-hidden sm:grid-cols-[200px_1fr]">
            <img src={asset(photo)} alt={`Camera ${room.number}`} className="h-48 w-full object-cover sm:h-full" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-3">
              <div><p className="label">Camera</p><p className="num font-display text-3xl text-heading">{room.number}</p><p className="text-xs text-subtle">{room.floor === 0 ? "Parter" : `Etajul ${room.floor}`}</p></div>
              <div><p className="label">Sosire</p><p className="font-display text-xl text-heading">{fmtLong(r.checkIn)}</p><p className="text-xs text-subtle">de la {p.checkInTime}</p></div>
              <div><p className="label">Plecare</p><p className="font-display text-xl text-heading">{fmtLong(r.checkOut)}</p><p className="text-xs text-subtle">până la {p.checkOutTime}</p></div>
              <div className="col-span-2"><p className="label">Tip</p><p>{type.name}</p><p className="text-xs text-subtle">{SEA_VIEW[room.seaView as keyof typeof SEA_VIEW]} · {room.bedSetup}</p></div>
              <div><p className="label">Persoane</p><p>{r.adults} adulți{r.children ? `, ${r.children} copii` : ""}</p><p className="text-xs text-subtle">{nights} nopți</p></div>
            </div>
          </section>

          <Card title="Plăți">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><dt className="label">Cazare</dt><dd className="num mt-1 font-display text-2xl text-heading">{lei(r.totalAmount)}</dd></div>
              <div><dt className="label">Taxă turistică</dt><dd className="num mt-1 font-display text-2xl text-heading">{lei(r.touristTax)}</dd></div>
              <div><dt className="label">Extra</dt><dd className="num mt-1 font-display text-2xl text-heading">{lei(extras)}</dd></div>
              <div><dt className="label">{due > 0.5 ? "Rest de plată" : "Achitat"}</dt><dd className={`num mt-1 font-display text-2xl ${due > 0.5 ? "text-warning" : "text-success"}`}>{lei(Math.max(0, due))}</dd></div>
            </dl>
            {payments.length > 0 && (
              <table className="table-lux mt-6">
                <thead><tr><th>Data</th><th>Metodă</th><th>Tip</th><th className="text-right">Sumă</th></tr></thead>
                <tbody>
                  {payments.map((x) => (
                    <tr key={x.id}><td className="num">{fmtLong(x.paidAt)}</td><td>{PAYMENT_METHOD[x.method as keyof typeof PAYMENT_METHOD] ?? x.method}</td><td className="text-subtle">{{ advance: "Avans", final: "Achitare", refund: "Restituire" }[x.kind] ?? x.kind}</td><td className="num text-right">{lei(x.amount, true)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {r.status !== "cancelled" && <PaymentForm reservationId={r.id} due={due} />}
          </Card>

          <Card title="Extra la sejur">
            {purchases.length === 0 ? <p className="text-sm text-subtle">Niciun serviciu extra. Oaspeții primesc ofertele în mesajul dinaintea sosirii.</p> : (
              <ul className="divide-y divide-line">
                {purchases.map((x) => {
                  const o = db.offers.find((of) => of.id === x.offerId)!;
                  return (
                    <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1"><p className="text-heading">{o.title}</p><p className="text-xs text-subtle">{UPSELL_CATEGORY[o.category as keyof typeof UPSELL_CATEGORY]} · {x.quantity} × {lei(x.amount)}</p></div>
                      <span className={`text-xs ${x.status === "paid" ? "text-success" : x.status === "cancelled" ? "text-error" : "text-warning"}`}>{{ paid: "Plătit", pending: "De încasat", cancelled: "Anulat", offered: "Oferit" }[x.status]}</span>
                      {x.status === "pending" && (
                        <>
                          <button className="btn-ghost btn-sm" onClick={() => setPurchaseStatus(x.id, "paid")}>Marchează plătit</button>
                          <button className="btn-ghost btn-sm" onClick={() => setPurchaseStatus(x.id, "cancelled")}>Anulează</button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <AddExtra reservationId={r.id} />
          </Card>

          <Card title="Modifică rezervarea"><EditForm id={r.id} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Oaspetele" action={<Link to={`/oaspeti/${guest.id}`} className="text-xs text-gold-text hover:underline">Fișa completă</Link>}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-subtle">Telefon</dt><dd className="num">{guest.phone ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">E-mail</dt><dd className="truncate">{guest.email ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Oraș</dt><dd>{guest.city ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Sejururi la Adonis</dt><dd className="num">{stays}</dd></div>
            </dl>
            {(tags.length > 0 || guest.allergies || guest.preferences) && (
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-full border border-gold/40 bg-gold-soft px-2.5 py-0.5 text-xs text-gold-text">{t.replace(/_/g, " ")}</span>)}</div>}
                {guest.allergies && <p className="text-error">Alergii: {guest.allergies}</p>}
                {guest.preferences && <p className="text-subtle">Preferă: {guest.preferences}</p>}
              </div>
            )}
          </Card>

          <Card title={<h2 className="flex items-center gap-2 text-xl"><MessageCircle size={18} strokeWidth={1.4} className="text-gold" /> Mesaje gata de trimis</h2>}>
            <div className="space-y-4">
              {db.templates.filter((t) => t.active).map((t) => {
                const text = renderTemplate(t.body, vars);
                return (
                  <details key={t.id} className="group rounded border border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm"><span className="text-heading">{t.name}</span><span className="text-xs text-subtle group-open:hidden">Arată</span></summary>
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
                      {phone ? <a className="btn-primary btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}>Trimite pe WhatsApp</a> : <p className="text-xs text-subtle">Adăugați telefonul oaspetelui ca să trimiteți pe WhatsApp.</p>}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>

          <Card title={<h2 className="flex items-center gap-2 text-xl"><FileText size={18} strokeWidth={1.4} className="text-gold" /> Facturi</h2>}>
            {invoices.length === 0 ? <p className="text-sm text-subtle">Nicio factură emisă.</p> : (
              <ul className="space-y-2 text-sm">
                {invoices.map((i) => <li key={i.id} className="flex justify-between"><Link to={`/facturi?f=${i.id}`} className="num text-gold-text hover:underline">{i.series} {String(i.number).padStart(5, "0")}</Link><span className="num">{lei(i.total, true)}</span></li>)}
              </ul>
            )}
            {r.status !== "cancelled" && <button className="btn-ghost mt-4 w-full" onClick={() => issueInvoice(r.id)}>Emite factură</button>}
          </Card>

          <Card title="Check-in online">
            {checkin ? (
              <div className="space-y-4 text-sm">
                <p className="text-success">Completat pe {fmtDateTime(checkin.signedAt)}{checkin.arrivalTime ? ` · sosire în jur de ${checkin.arrivalTime}` : ""}</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-4"><dt className="text-subtle">Act</dt><dd className="num">{checkin.idDocType === "CI" ? "CI" : "Pașaport"} {checkin.idDocNumber}</dd></div>
                  {guest.cnp && <div className="flex justify-between gap-4"><dt className="text-subtle">CNP</dt><dd className="num">{guest.cnp}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-subtle">Contract</dt><dd>versiunea {checkin.contractVersion}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-3">
                  <StoredImage k={checkin.imageKey} alt="Actul de identitate" className="h-28 w-full rounded-sm border border-line object-cover" />
                  <div className="flex items-center justify-center rounded-sm border border-line bg-white p-2"><StoredImage k={checkin.signatureKey} alt="Semnătura" className="max-h-24" /></div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-subtle">Oaspetele completează actul de identitate și semnează contractul de pe telefon, înainte de sosire.</p>
                <Link to={`/oaspete/${r.checkinToken}/checkin`} className="btn-ghost mt-3 w-full">Deschide pagina oaspetelui</Link>
              </>
            )}
          </Card>

          <Card title="Plată online">
            {links.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <span>{{ balance: "Rest de plată", upsell: "Extra", advance: "Avans" }[l.purpose] ?? l.purpose}</span>
                    <span className="num">{lei(l.amount)}</span>
                    {l.status === "paid" ? <span className="text-success">plătit</span> : <Link to={`/plata/${l.id}`} className="text-xs text-gold-text hover:underline">deschide</Link>}
                  </li>
                ))}
              </ul>
            )}
            {due > 0.5 && r.status !== "cancelled" ? (
              <button className="btn-ghost w-full" onClick={() => createPaymentLink(r.id, due, "balance")}>Creează link de plată pentru {lei(due)}</button>
            ) : <p className="text-sm text-subtle">Nimic de încasat.</p>}
            <p className="mt-3 text-xs text-subtle">În versiunea Pages plata e demonstrativă: nu se încasează bani.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ reservationId, due }: { reservationId: string; due: number }) {
  const [amount, setAmount] = useState(due > 0 ? due.toFixed(2) : "");
  const [method, setMethod] = useState("card");
  const [ref, setRef] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addPayment(reservationId, Number(amount), method, ref || null);
        setAmount("");
        setRef("");
      }}
      className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
    >
      <Field label="Încasează (lei)"><input id="pay-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field" /></Field>
      <Field label="Metodă"><select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className="field">{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Referință"><input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} className="field" placeholder="Nr. bon, chitanță" /></Field>
      <button className="btn-primary">Înregistrează</button>
    </form>
  );
}

function AddExtra({ reservationId }: { reservationId: string }) {
  const db = useDb();
  const offers = db.offers.filter((o) => o.active);
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [qty, setQty] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); addPurchase(reservationId, offerId, Number(qty) || undefined); setQty(""); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
      <Field label="Adaugă" className="min-w-[220px] flex-1"><select id="extra-offer" value={offerId} onChange={(e) => setOfferId(e.target.value)} className="field">{offers.map((o) => <option key={o.id} value={o.id}>{o.title} · {lei(o.price)}</option>)}</select></Field>
      <Field label="Cantitate" className="w-24"><input id="extra-qty" type="number" min={1} placeholder="auto" value={qty} onChange={(e) => setQty(e.target.value)} className="field" /></Field>
      <button className="btn-ghost">Adaugă</button>
    </form>
  );
}

function EditForm({ id }: { id: string }) {
  const db = useDb();
  const r = db.reservations.find((x) => x.id === id)!;
  const [f, setF] = useState({ roomId: r.roomId, checkIn: isoDay(r.checkIn), checkOut: isoDay(r.checkOut), adults: r.adults, children: r.children, totalAmount: Math.round(r.totalAmount), voucherType: r.voucherType ?? "", notes: r.notes ?? "", requote: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f, v: string | number | boolean) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const err = updateReservation(id, { ...f, checkIn: parseDay(f.checkIn), checkOut: parseDay(f.checkOut), voucherType: f.voucherType || null, notes: f.notes || null });
        setMsg(err ? { ok: false, text: err } : { ok: true, text: "Modificările au fost salvate." });
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sosire"><input id="e-in" type="date" value={f.checkIn} onChange={(e) => set("checkIn", e.target.value)} className="field" /></Field>
        <Field label="Plecare"><input id="e-out" type="date" value={f.checkOut} onChange={(e) => set("checkOut", e.target.value)} className="field" /></Field>
        <Field label="Camera" className="sm:col-span-2"><select id="e-room" value={f.roomId} onChange={(e) => set("roomId", e.target.value)} className="field">{db.rooms.map((x) => <option key={x.id} value={x.id}>{x.number} · {db.roomTypes.find((t) => t.id === x.roomTypeId)!.name}</option>)}</select></Field>
        <Field label="Adulți"><input id="e-ad" type="number" min={1} value={f.adults} onChange={(e) => set("adults", Number(e.target.value))} className="field" /></Field>
        <Field label="Copii"><input id="e-ch" type="number" min={0} value={f.children} onChange={(e) => set("children", Number(e.target.value))} className="field" /></Field>
        <Field label="Total cazare (lei)"><input id="e-total" type="number" value={f.totalAmount} onChange={(e) => set("totalAmount", Number(e.target.value))} className="field" /></Field>
        <Field label="Voucher"><select id="e-v" value={f.voucherType} onChange={(e) => set("voucherType", e.target.value)} className="field"><option value="">Fără voucher</option><option value="sodexo">Sodexo (Pluxee)</option><option value="edenred">Edenred</option><option value="up">UP România</option><option value="card_vacanta">Card de vacanță</option></select></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.requote} onChange={(e) => set("requote", e.target.checked)} className="accent-[#c6a15b]" /> Recalculează prețul după tarifele de sezon</label>
      <Field label="Observații"><textarea id="e-notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="field" /></Field>
      {msg && <Notice tone={msg.ok ? "success" : "error"}>{msg.text}</Notice>}
      <button className="btn-primary">Salvează modificările</button>
    </form>
  );
}

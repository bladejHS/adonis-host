import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Field, Notice, PageHeader } from "@/components/ui";
import { useDb } from "../data/store";
import { createReservation, findConflict, quote } from "../data/actions";
import { addDays, isoDay, lei, parseDay, today } from "../lib";

export function ReservationNew() {
  const db = useDb();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const start = sp.get("date") ?? isoDay(today());
  const [roomId, setRoomId] = useState(sp.get("room") ?? "");
  const [checkIn, setCheckIn] = useState(start);
  const [checkOut, setCheckOut] = useState(isoDay(addDays(parseDay(start), 2)));
  const [adults, setAdults] = useState(2);
  const [f, setF] = useState({ children: 0, source: "phone", firstName: "", lastName: "", phone: "", email: "", city: "", voucherType: "", notes: "", totalAmount: "", advance: "0", paymentMethod: "transfer", status: "confirmed" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));

  const q = useMemo(() => {
    const a = parseDay(checkIn);
    const b = parseDay(checkOut);
    if (!roomId || isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return null;
    const res = quote(db, roomId, a, b, adults);
    const c = findConflict(db, roomId, a, b);
    return { ...res, seasons: Array.from(new Set(res.nights.map((n) => n.season ?? "Extrasezon"))), conflict: c ? `${c.guest.firstName} ${c.guest.lastName} (${c.code})` : null };
  }, [db, roomId, checkIn, checkOut, adults]);

  const floors = Array.from(new Set(db.rooms.map((r) => r.floor)));
  const typeOf = (id: string) => db.roomTypes.find((t) => t.id === id)!;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = createReservation({
      roomId, checkIn: parseDay(checkIn), checkOut: parseDay(checkOut), adults, children: Number(f.children), source: f.source, status: f.status,
      totalAmount: Number(f.totalAmount) || undefined, advance: Number(f.advance) || 0, paymentMethod: f.paymentMethod, voucherType: f.voucherType || null, notes: f.notes || null,
      guest: { firstName: f.firstName, lastName: f.lastName, phone: f.phone || null, email: f.email || null, city: f.city || null },
    });
    if (r.error) setError(r.error);
    else nav(`/rezervari/${r.id}?nou=1`);
  };

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Rezervare nouă" description="Prețul se calculează automat după sezon. Verificăm pe loc dacă camera e liberă." />
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <fieldset className="card space-y-5 p-6">
            <h2 className="text-2xl">Sejurul</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sosire"><input id="checkIn" type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="field" /></Field>
              <Field label="Plecare"><input id="checkOut" type="date" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="field" /></Field>
            </div>
            <Field label="Camera">
              <select id="roomId" required value={roomId} onChange={(e) => setRoomId(e.target.value)} className="field">
                <option value="">Alegeți camera…</option>
                {floors.map((fl) => (
                  <optgroup key={fl} label={fl === 0 ? "Parter" : `Etajul ${fl}`}>
                    {db.rooms.filter((r) => r.floor === fl).map((r) => <option key={r.id} value={r.id}>{r.number} · {typeOf(r.roomTypeId).name} · max. {typeOf(r.roomTypeId).capacity} pers.</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Adulți"><input id="adults" type="number" min={1} max={6} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="field" /></Field>
              <Field label="Copii"><input id="children" type="number" min={0} max={4} value={f.children} onChange={(e) => set("children", Number(e.target.value))} className="field" /></Field>
              <Field label="Canal">
                <select id="source" value={f.source} onChange={(e) => set("source", e.target.value)} className="field">
                  <option value="phone">Telefon</option><option value="direct">Direct (site, e-mail)</option><option value="booking">Booking.com</option><option value="airbnb">Airbnb</option><option value="other">Altele</option>
                </select>
              </Field>
            </div>
          </fieldset>
          <fieldset className="card space-y-5 p-6">
            <h2 className="text-2xl">Oaspetele</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prenume"><input id="firstName" required value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className="field" /></Field>
              <Field label="Nume"><input id="lastName" required value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className="field" /></Field>
              <Field label="Telefon" hint="Dacă oaspetele a mai fost la noi, îl recunoaștem după telefon sau e-mail."><input id="phone" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} className="field" placeholder="07xx xxx xxx" /></Field>
              <Field label="E-mail"><input id="email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="field" /></Field>
              <Field label="Oraș"><input id="city" value={f.city} onChange={(e) => set("city", e.target.value)} className="field" /></Field>
              <Field label="Voucher de vacanță">
                <select id="voucher" value={f.voucherType} onChange={(e) => set("voucherType", e.target.value)} className="field">
                  <option value="">Fără voucher</option><option value="sodexo">Sodexo (Pluxee)</option><option value="edenred">Edenred</option><option value="up">UP România</option><option value="card_vacanta">Card de vacanță</option>
                </select>
              </Field>
            </div>
            <Field label="Observații"><textarea id="notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="field" placeholder="Ex: sosesc după ora 22, aniversare, pătuț pentru bebeluș" /></Field>
          </fieldset>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="card overflow-hidden">
            <div className="bg-navy-900 px-6 py-5 text-ivory-50">
              <p className="label text-gold-300">Ofertă de preț</p>
              <p className="num mt-2 font-display text-[2.6rem] leading-none">{q ? lei(q.total) : "—"}</p>
              <p className="mt-1 text-sm text-navy-300">{q ? `${q.nights.length} nopți · ${q.seasons.join(", ")}` : "Alegeți camera și datele"}</p>
            </div>
            <div className="space-y-4 p-6">
              {q && (
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-subtle">Cazare</dt><dd className="num">{lei(q.total)}</dd></div>
                  <div className="flex justify-between"><dt className="text-subtle">Taxă turistică</dt><dd className="num">{lei(q.tax)}</dd></div>
                  <div className="rule-gold my-2" />
                  <div className="flex justify-between font-medium"><dt>De plată</dt><dd className="num">{lei(q.total + q.tax)}</dd></div>
                </dl>
              )}
              {q && !q.minStayOk && <Notice tone="warning">În această perioadă se rezervă minimum {q.minStay} nopți.</Notice>}
              {q?.conflict && <Notice tone="error" title="Camera e ocupată">{q.conflict}</Notice>}
              <Field label="Preț negociat (opțional)" hint="Lăsați gol pentru tariful calculat."><input id="total" type="number" min="0" value={f.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} className="field" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Avans încasat"><input id="advance" type="number" min="0" value={f.advance} onChange={(e) => set("advance", e.target.value)} className="field" /></Field>
                <Field label="Metodă">
                  <select id="method" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className="field"><option value="transfer">Transfer</option><option value="card">Card</option><option value="cash">Numerar</option><option value="voucher">Voucher</option></select>
                </Field>
              </div>
              <Field label="Stare">
                <select id="state" value={f.status} onChange={(e) => set("status", e.target.value)} className="field"><option value="confirmed">Confirmată</option><option value="pending">În așteptare (fără avans)</option></select>
              </Field>
              {error && <Notice tone="error">{error}</Notice>}
              <button className="btn-primary w-full">Salvează rezervarea</button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

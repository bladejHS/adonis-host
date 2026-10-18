"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { createReservation, quote } from "@/lib/actions";
import { Field, Notice } from "./ui";
import { Submit } from "./submit";

type RoomOpt = { id: string; number: string; floor: number; type: string; capacity: number; seaView: string };
type Quote = Awaited<ReturnType<typeof quote>>;

const lei = (n: number) => `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n)} lei`;

export function ReservationForm({ rooms, defaults }: { rooms: RoomOpt[]; defaults: { checkIn: string; checkOut: string; roomId?: string } }) {
  const [state, action] = useFormState(createReservation, undefined);
  const [roomId, setRoomId] = useState(defaults.roomId ?? "");
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(2);
  const [q, setQ] = useState<Quote>(null);
  const [pending, start] = useTransition();
  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  useEffect(() => {
    start(async () => setQ(await quote(roomId, checkIn, checkOut, adults)));
  }, [roomId, checkIn, checkOut, adults]);

  const floors = Array.from(new Set(rooms.map((r) => r.floor)));

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <fieldset className="card space-y-5 p-6">
          <h2 className="text-2xl">Sejurul</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sosire">
              <input type="date" name="checkIn" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="field" />
            </Field>
            <Field label="Plecare">
              <input type="date" name="checkOut" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="field" />
            </Field>
          </div>
          <Field label="Camera">
            <select name="roomId" required value={roomId} onChange={(e) => setRoomId(e.target.value)} className="field">
              <option value="">Alegeți camera…</option>
              {floors.map((f) => (
                <optgroup key={f} label={f === 0 ? "Parter" : `Etajul ${f}`}>
                  {rooms
                    .filter((r) => r.floor === f)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} · {r.type} · max. {r.capacity} pers.
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Adulți">
              <input type="number" name="adults" min={1} max={6} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="field" />
            </Field>
            <Field label="Copii">
              <input type="number" name="children" min={0} max={4} defaultValue={0} className="field" />
            </Field>
            <Field label="Canal">
              <select name="source" defaultValue="phone" className="field">
                <option value="phone">Telefon</option>
                <option value="direct">Direct (site, e-mail)</option>
                <option value="booking">Booking.com</option>
                <option value="airbnb">Airbnb</option>
                <option value="other">Altele</option>
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="card space-y-5 p-6">
          <h2 className="text-2xl">Oaspetele</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prenume">
              <input name="firstName" required className="field" autoComplete="off" />
            </Field>
            <Field label="Nume">
              <input name="lastName" required className="field" autoComplete="off" />
            </Field>
            <Field label="Telefon" hint="Dacă oaspetele a mai fost la noi, îl recunoaștem după telefon sau e-mail.">
              <input name="phone" type="tel" className="field" placeholder="07xx xxx xxx" />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" className="field" />
            </Field>
            <Field label="Oraș">
              <input name="city" className="field" />
            </Field>
            <Field label="Voucher de vacanță">
              <select name="voucherType" defaultValue="" className="field">
                <option value="">Fără voucher</option>
                <option value="sodexo">Sodexo (Pluxee)</option>
                <option value="edenred">Edenred</option>
                <option value="up">UP România</option>
                <option value="card_vacanta">Card de vacanță</option>
              </select>
            </Field>
          </div>
          <Field label="Observații">
            <textarea name="notes" rows={3} className="field" placeholder="Ex: sosesc după ora 22, aniversare, pătuț pentru bebeluș" />
          </Field>
        </fieldset>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bg-navy-900 px-6 py-5 text-ivory-50">
            <p className="label text-gold-300">Ofertă de preț</p>
            <p className="num mt-2 font-display text-[2.6rem] leading-none">{q ? lei(q.total) : "—"}</p>
            <p className="mt-1 text-sm text-navy-300">
              {q ? `${q.nights} nopți · ${q.seasons.join(", ")}` : room ? "Alegeți datele" : "Alegeți camera și datele"}
              {pending && " · se calculează…"}
            </p>
          </div>
          <div className="space-y-4 p-6">
            {q && (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-subtle">Cazare</dt>
                  <dd className="num">{lei(q.total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-subtle">Taxă turistică</dt>
                  <dd className="num">{lei(q.tax)}</dd>
                </div>
                <div className="rule-gold my-2" />
                <div className="flex justify-between font-medium">
                  <dt>De plată</dt>
                  <dd className="num">{lei(q.total + q.tax)}</dd>
                </div>
              </dl>
            )}
            {q && !q.minStayOk && <Notice tone="warning">În această perioadă se rezervă minimum {q.minStay} nopți.</Notice>}
            {q?.conflict && (
              <Notice tone="error" title="Camera e ocupată">
                {q.conflict}
              </Notice>
            )}
            <Field label="Preț negociat (opțional)" hint="Lăsați gol pentru tariful calculat.">
              <input name="totalAmount" type="number" step="1" min="0" className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Avans încasat">
                <input name="advance" type="number" step="1" min="0" defaultValue={0} className="field" />
              </Field>
              <Field label="Metodă">
                <select name="paymentMethod" className="field" defaultValue="transfer">
                  <option value="transfer">Transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Numerar</option>
                  <option value="voucher">Voucher</option>
                </select>
              </Field>
            </div>
            <Field label="Stare">
              <select name="status" className="field" defaultValue="confirmed">
                <option value="confirmed">Confirmată</option>
                <option value="pending">În așteptare (fără avans)</option>
              </select>
            </Field>
            {state?.error && <Notice tone="error">{state.error}</Notice>}
            <Submit className="btn-primary w-full" pendingText="Se salvează rezervarea…">
              Salvează rezervarea
            </Submit>
          </div>
        </div>
      </aside>
    </form>
  );
}

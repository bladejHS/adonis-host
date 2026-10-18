import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MessageCircle } from "lucide-react";
import { PAYMENT_METHOD, SEA_VIEW, UPSELL_CATEGORY, nightsBetween } from "@adonis/database";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtLong, isoDay, json, lei } from "@/lib/format";
import { addPayment, addUpsellToReservation, issueInvoice, setPurchaseStatus, setReservationStatus } from "@/lib/actions";
import { renderTemplate, type TemplateVars } from "@/lib/template-vars";
import { Card, Field, Notice, SourceTag, StatusBadge } from "@/components/ui";
import { ReservationEdit } from "@/components/reservation-edit";
import { Submit } from "@/components/submit";

export default async function ReservationDetail({ params, searchParams }: { params: { id: string }; searchParams: { nou?: string } }) {
  const r = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      guest: { include: { _count: { select: { reservations: true } } } },
      room: { include: { roomType: true, property: true } },
      channel: true,
      payments: { orderBy: { paidAt: "asc" } },
      invoices: true,
      purchases: { include: { offer: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) notFound();
  const [rooms, offers, templates] = await Promise.all([
    prisma.room.findMany({ include: { roomType: true }, orderBy: { number: "asc" } }),
    prisma.upsellOffer.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.messageTemplate.findMany({ where: { active: true } }),
  ]);

  const p = r.room.property;
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const extras = r.purchases.filter((x) => x.status !== "cancelled").reduce((s, x) => s + x.amount * x.quantity, 0);
  const grand = r.totalAmount + r.touristTax + extras;
  const due = grand - r.paidAmount;
  const tags = json<string[]>(r.guest.tags, []);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const vars: TemplateVars = {
    guest_name: r.guest.firstName,
    guest_full_name: `${r.guest.firstName} ${r.guest.lastName}`,
    reservation_code: r.code,
    check_in_date: fmtLong(r.checkIn),
    check_out_date: fmtLong(r.checkOut),
    check_in_time: p.checkInTime,
    check_out_time: p.checkOutTime,
    room_number: r.room.number,
    room_type: r.room.roomType.name,
    nights: String(nights),
    total: lei(grand),
    balance: lei(Math.max(0, due)),
    wifi_name: p.wifiName ?? "",
    wifi_password: p.wifiPassword ?? "",
    checkin_link: `${base.replace(":3000", ":3001")}/checkin/${r.checkinToken}`,
    next_year: String(r.checkIn.getUTCFullYear() + 1),
  };
  const phone = (r.guest.phone ?? "").replace(/\D/g, "").replace(/^0/, "40");

  return (
    <div className="space-y-8">
      <Link href="/rezervari" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-heading">
        <ArrowLeft size={15} /> Toate rezervările
      </Link>

      {searchParams.nou && <Notice tone="success" title="Rezervarea a fost salvată">Codul {r.code} poate fi trimis oaspetelui. Mai jos găsiți mesajul de confirmare gata scris.</Notice>}
      {r.notes?.includes("Suprapunere") && <Notice tone="error" title="Suprapunere de rezervări">{r.notes}</Notice>}

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="label text-gold-text">{r.code}</p>
          <h1 className="text-[2.6rem] leading-none">
            {r.guest.firstName} {r.guest.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
            <StatusBadge status={r.status} />
            <SourceTag source={r.source} />
            <span>Creată pe {fmtLong(r.createdAt)}</span>
            {r.lastSyncedAt && <span>· sincronizată {fmtDateTime(r.lastSyncedAt)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["pending"].includes(r.status) && (
            <form action={setReservationStatus.bind(null, r.id, "confirmed")}><Submit className="btn-primary">Confirmă</Submit></form>
          )}
          {["pending", "confirmed"].includes(r.status) && (
            <form action={setReservationStatus.bind(null, r.id, "checked_in")}><Submit className="btn-gold">Check-in</Submit></form>
          )}
          {r.status === "checked_in" && (
            <form action={setReservationStatus.bind(null, r.id, "checked_out")}><Submit className="btn-gold">Check-out</Submit></form>
          )}
          {["pending", "confirmed"].includes(r.status) && (
            <>
              <form action={setReservationStatus.bind(null, r.id, "no_show")}><Submit className="btn-ghost">Neprezentat</Submit></form>
              <form action={setReservationStatus.bind(null, r.id, "cancelled")}><Submit className="btn-danger">Anulează</Submit></form>
            </>
          )}
          {["cancelled", "no_show"].includes(r.status) && (
            <form action={setReservationStatus.bind(null, r.id, "confirmed")}><Submit className="btn-ghost">Reactivează</Submit></form>
          )}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <section className="card grid overflow-hidden sm:grid-cols-[200px_1fr]">
            <img src={r.room.seaView === "full" ? "/photos/room-sea-double.webp" : r.room.floor === 0 ? "/photos/room-garden.webp" : r.room.roomType.capacity > 2 ? "/photos/room-quad.webp" : "/photos/room-sea-3.webp"} alt={`Camera ${r.room.number}`} className="h-48 w-full object-cover sm:h-full" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-3">
              <div><p className="label">Camera</p><p className="num font-display text-3xl text-heading">{r.room.number}</p><p className="text-xs text-subtle">{r.room.floor === 0 ? "Parter" : `Etajul ${r.room.floor}`}</p></div>
              <div><p className="label">Sosire</p><p className="font-display text-xl text-heading">{fmtLong(r.checkIn)}</p><p className="text-xs text-subtle">de la {p.checkInTime}</p></div>
              <div><p className="label">Plecare</p><p className="font-display text-xl text-heading">{fmtLong(r.checkOut)}</p><p className="text-xs text-subtle">până la {p.checkOutTime}</p></div>
              <div className="col-span-2"><p className="label">Tip</p><p>{r.room.roomType.name}</p><p className="text-xs text-subtle">{SEA_VIEW[r.room.seaView as keyof typeof SEA_VIEW]} · {r.room.bedSetup}</p></div>
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
            {r.payments.length > 0 && (
              <table className="table-lux mt-6">
                <thead><tr><th>Data</th><th>Metodă</th><th>Tip</th><th className="text-right">Sumă</th></tr></thead>
                <tbody>
                  {r.payments.map((x) => (
                    <tr key={x.id}>
                      <td className="num">{fmtLong(x.paidAt)}</td>
                      <td>{PAYMENT_METHOD[x.method as keyof typeof PAYMENT_METHOD] ?? x.method}</td>
                      <td className="text-subtle">{{ advance: "Avans", final: "Achitare", refund: "Restituire" }[x.kind] ?? x.kind}</td>
                      <td className="num text-right">{lei(x.amount, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!["cancelled"].includes(r.status) && (
              <form action={addPayment} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="reservationId" value={r.id} />
                <Field label="Încasează (lei)"><input name="amount" type="number" step="0.01" defaultValue={due > 0 ? due.toFixed(2) : ""} className="field" /></Field>
                <Field label="Metodă">
                  <select name="method" className="field" defaultValue="card">
                    {Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Referință"><input name="reference" className="field" placeholder="Nr. bon, chitanță" /></Field>
                <Submit className="btn-primary">Înregistrează</Submit>
              </form>
            )}
          </Card>

          <Card title="Extra la sejur">
            {r.purchases.length === 0 ? (
              <p className="text-sm text-subtle">Niciun serviciu extra. Oaspeții primesc ofertele în mesajul dinaintea sosirii.</p>
            ) : (
              <ul className="divide-y divide-line">
                {r.purchases.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-heading">{x.offer.title}</p>
                      <p className="text-xs text-subtle">{UPSELL_CATEGORY[x.offer.category as keyof typeof UPSELL_CATEGORY]} · {x.quantity} × {lei(x.amount)}</p>
                    </div>
                    <span className={`text-xs ${x.status === "paid" ? "text-success" : x.status === "cancelled" ? "text-error" : "text-warning"}`}>{{ paid: "Plătit", pending: "De încasat", cancelled: "Anulat", offered: "Oferit" }[x.status]}</span>
                    {x.status === "pending" && (
                      <>
                        <form action={setPurchaseStatus.bind(null, x.id, "paid")}><button className="btn-ghost btn-sm">Marchează plătit</button></form>
                        <form action={setPurchaseStatus.bind(null, x.id, "cancelled")}><button className="btn-ghost btn-sm">Anulează</button></form>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form action={addUpsellToReservation} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
              <input type="hidden" name="reservationId" value={r.id} />
              <Field label="Adaugă" className="min-w-[220px] flex-1">
                <select name="offerId" className="field">
                  {offers.map((o) => <option key={o.id} value={o.id}>{o.title} · {lei(o.price)}</option>)}
                </select>
              </Field>
              <Field label="Cantitate" className="w-24"><input name="quantity" type="number" min={1} placeholder="auto" className="field" /></Field>
              <Submit className="btn-ghost">Adaugă</Submit>
            </form>
          </Card>

          <Card title="Modifică rezervarea">
            <ReservationEdit
              id={r.id}
              roomId={r.roomId}
              checkIn={isoDay(r.checkIn)}
              checkOut={isoDay(r.checkOut)}
              adults={r.adults}
              children={r.children}
              totalAmount={r.totalAmount}
              notes={r.notes ?? ""}
              voucherType={r.voucherType ?? ""}
              rooms={rooms.map((x) => ({ id: x.id, label: `${x.number} · ${x.roomType.name}` }))}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Oaspetele" action={<Link href={`/oaspeti/${r.guestId}`} className="text-xs text-gold-text hover:underline">Fișa completă</Link>}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-subtle">Telefon</dt><dd className="num">{r.guest.phone ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">E-mail</dt><dd className="truncate">{r.guest.email ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Oraș</dt><dd>{r.guest.city ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Sejururi la Adonis</dt><dd className="num">{r.guest._count.reservations}</dd></div>
              {r.voucherType && <div className="flex justify-between gap-4"><dt className="text-subtle">Plată cu voucher</dt><dd className="capitalize">{r.voucherType.replace("_", " ")}</dd></div>}
            </dl>
            {(tags.length > 0 || r.guest.allergies || r.guest.preferences) && (
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => <span key={t} className="rounded-full border border-gold/40 bg-gold-soft px-2.5 py-0.5 text-xs text-gold-text">{t.replace(/_/g, " ")}</span>)}
                  </div>
                )}
                {r.guest.allergies && <p className="text-error">Alergii: {r.guest.allergies}</p>}
                {r.guest.preferences && <p className="text-subtle">Preferă: {r.guest.preferences}</p>}
              </div>
            )}
            {r.notes && !r.notes.includes("Suprapunere") && <p className="mt-4 border-t border-line pt-4 text-sm italic text-subtle">„{r.notes}”</p>}
          </Card>

          <Card title={<h2 className="flex items-center gap-2 text-xl"><MessageCircle size={18} strokeWidth={1.4} className="text-gold" /> Mesaje gata de trimis</h2>}>
            <div className="space-y-4">
              {templates.map((t) => {
                const text = renderTemplate(t.body, vars);
                return (
                  <details key={t.id} className="group rounded border border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
                      <span className="text-heading">{t.name}</span>
                      <span className="text-xs text-subtle group-open:hidden">Arată</span>
                    </summary>
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
                      {phone ? (
                        <a className="btn-primary btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}>Deschide în WhatsApp</a>
                      ) : (
                        <p className="text-xs text-subtle">Adăugați telefonul oaspetelui ca să trimiteți pe WhatsApp.</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>

          <Card title={<h2 className="flex items-center gap-2 text-xl"><FileText size={18} strokeWidth={1.4} className="text-gold" /> Facturi</h2>}>
            {r.invoices.length === 0 ? (
              <p className="text-sm text-subtle">Nicio factură emisă.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {r.invoices.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <Link href={`/facturi?f=${i.id}`} className="num text-gold-text hover:underline">{i.series} {String(i.number).padStart(5, "0")}</Link>
                    <span className="num">{lei(i.total, true)}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.status !== "cancelled" && (
              <form action={async () => { "use server"; await issueInvoice(r.id); }} className="mt-4">
                <Submit className="btn-ghost w-full" pendingText="Se emite…">Emite factură</Submit>
              </form>
            )}
            <p className="mt-3 text-xs text-subtle">Trimiterea în e-Factura ANAF prin SmartBill se activează în Faza 4.</p>
          </Card>

          <Card title="Check-in online">
            <p className="text-sm text-subtle">Oaspetele completează actul de identitate și semnează contractul de pe telefon, înainte de sosire.</p>
            <p className="num mt-3 break-all rounded-sm bg-muted px-3 py-2 text-xs">{vars.checkin_link}</p>
            <p className="mt-2 text-xs text-subtle">{r.checkinDoneAt ? `Completat pe ${fmtLong(r.checkinDoneAt)}.` : "Pagina pentru oaspeți se construiește în Faza 3."}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

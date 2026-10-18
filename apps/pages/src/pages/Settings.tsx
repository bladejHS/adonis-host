import { useState } from "react";
import { REGISTRY_HEADERS, computeMonthlySeries, toCsv, type RegistryRow } from "@adonis/core/pure";
import { Card, Field, Notice, PageHeader } from "@/components/ui";
import { getDb, replaceDb, resetDemo, setSession, useDb, useSession } from "../data/store";
import { updateProperty } from "../data/actions";
import type { Db } from "../data/types";
import { ROLE_LABEL, download, isoDay, parseDay, today } from "../lib";

export function Settings() {
  const db = useDb();
  const session = useSession();
  const p = db.property;
  const [f, setF] = useState({ ...p, legalName: p.legalName ?? "", cui: p.cui ?? "", regCom: p.regCom ?? "", phone: p.phone ?? "", email: p.email ?? "", wifiName: p.wifiName ?? "", wifiPassword: p.wifiPassword ?? "" });
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const t = today();
  const [range, setRange] = useState({ from: isoDay(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: isoDay(t), year: String(t.getUTCFullYear()) });
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof typeof f, label: string, cls = "") => <Field label={label} className={cls}><input id={`p-${k}`} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value)} className="field" /></Field>;

  const exportRegistry = () => {
    const from = parseDay(range.from);
    const to = new Date(parseDay(range.to).getTime() + 86_400_000);
    const rows: RegistryRow[] = db.reservations
      .filter((r) => ["checked_in", "checked_out"].includes(r.status) && r.checkIn >= from && r.checkIn < to)
      .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime())
      .map((r, i) => {
        const g = db.guests.find((x) => x.id === r.guestId)!;
        const c = db.checkins.find((x) => x.reservationId === r.id);
        return {
          nrCrt: i + 1, nume: g.lastName.toUpperCase(), prenume: g.firstName, dataNasterii: g.birthDate ? isoDay(g.birthDate) : "", locNasterii: "", cetatenie: g.country,
          domiciliu: g.city ?? "", tipAct: c?.idDocType ?? g.idDocType ?? "", serieNumarAct: c?.idDocNumber ?? g.idDocNumber ?? "", cnp: g.cnp ?? "",
          dataSosirii: isoDay(r.checkIn), dataPlecarii: isoDay(r.checkOut), camera: db.rooms.find((x) => x.id === r.roomId)!.number, scopulCalatoriei: "turism",
          insotitori: Math.max(0, r.adults + r.children - 1), rezervare: r.code,
        };
      });
    download(`evidenta-turisti-${range.from}_${range.to}.csv`, toCsv(rows, REGISTRY_HEADERS), "text/csv;charset=utf-8");
  };

  const exportReport = () => {
    const year = Number(range.year);
    const NAMES = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows = computeMonthlySeries(db.rooms.length, db.reservations, year, Array.from({ length: 12 }, (_, i) => i + 1)).map((m) => ({
      luna: NAMES[m.month - 1], ocupare: `${Math.round(m.occupancy * 1000) / 10}%`, nopti: m.sold, venit: r2(m.revenue), adr: r2(m.adr), revpar: r2(m.revpar), sosiri: m.bookings,
    }));
    download(`raport-adonis-${year}.csv`, toCsv(rows, { luna: "Luna", ocupare: "Ocupare", nopti: "Nopți vândute", venit: "Venit cazare (lei)", adr: "ADR (lei)", revpar: "RevPAR (lei)", sosiri: "Sosiri" }), "text/csv;charset=utf-8");
  };

  const backup = () => download(`adonis-copie-${isoDay(new Date())}.json`, JSON.stringify(getDb()), "application/json");
  const restore = async (file: File) => {
    const raw = JSON.parse(await file.text(), (k, v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) ? new Date(v) : v)) as Db;
    if (!raw.reservations || !raw.rooms) throw new Error("Fișierul nu este o copie Adonis Host.");
    replaceDb(raw);
  };

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader eyebrow="Administrare" title="Setări" description="Datele care apar pe facturi, în mesajele către oaspeți și în calculul taxelor." />
      <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); updateProperty({ ...f, vatRate: Number(f.vatRate), touristTaxValue: Number(f.touristTaxValue), legalName: f.legalName || null, cui: f.cui || null, regCom: f.regCom || null, phone: f.phone || null, email: f.email || null, wifiName: f.wifiName || null, wifiPassword: f.wifiPassword || null }); setSaved(true); }}>
        <section className="card space-y-4 p-6">
          <h2 className="text-2xl">Proprietatea</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("name", "Nume afișat")}{text("legalName", "Denumire firmă")}{text("cui", "CUI")}{text("regCom", "Nr. Registrul Comerțului")}
            {text("address", "Adresă", "sm:col-span-2")}{text("city", "Localitate")}{text("county", "Județ")}{text("phone", "Telefon recepție")}{text("email", "E-mail rezervări")}
          </div>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-2xl">Sejur & oaspeți</h2>
          <div className="grid gap-4 sm:grid-cols-4">{text("checkInTime", "Check-in de la")}{text("checkOutTime", "Check-out până la")}{text("wifiName", "Rețea Wi-Fi")}{text("wifiPassword", "Parolă Wi-Fi")}</div>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-2xl">Fiscal</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {text("invoiceSeries", "Serie facturi")}
            <Field label="TVA cazare (%)"><input id="p-vat" type="number" step="0.5" value={f.vatRate} onChange={(e) => set("vatRate", e.target.value)} className="field" /></Field>
            <Field label="Taxă turistică"><select id="p-taxmode" value={f.touristTaxMode} onChange={(e) => set("touristTaxMode", e.target.value)} className="field"><option value="percent">% din cazare</option><option value="per_night_person">lei / persoană / noapte</option></select></Field>
            <Field label="Valoare taxă"><input id="p-tax" type="number" step="0.1" value={f.touristTaxValue} onChange={(e) => set("touristTaxValue", e.target.value)} className="field" /></Field>
          </div>
        </section>
        {saved && <Notice tone="success">Setările au fost salvate.</Notice>}
        <button className="btn-primary">Salvează setările</button>
      </form>

      <Card title="Exporturi">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-heading">Evidența turiștilor</p>
            <p className="text-sm text-subtle">Rubricile fișei de anunțare a sosirii și plecării. CSV pentru Excel.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De la"><input id="x-from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="field" /></Field>
              <Field label="Până la"><input id="x-to" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="field" /></Field>
            </div>
            <button className="btn-ghost" onClick={exportRegistry}>Descarcă CSV</button>
          </div>
          <div className="space-y-3">
            <p className="text-heading">Raport anual pe luni</p>
            <p className="text-sm text-subtle">Ocupare, nopți, venit, ADR, RevPAR — pentru contabil sau bancă.</p>
            <Field label="Anul"><input id="x-year" type="number" value={range.year} onChange={(e) => setRange({ ...range, year: e.target.value })} className="field w-32" /></Field>
            <button className="btn-ghost" onClick={exportReport}>Descarcă CSV</button>
          </div>
        </div>
      </Card>

      <Card title="Datele de pe acest dispozitiv">
        <p className="text-sm text-subtle">Versiunea Pages lucrează fără server: totul se salvează în browserul acestui dispozitiv. Faceți o copie de siguranță ca să mutați datele pe alt calculator sau telefon.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={backup}>Descarcă copia de siguranță</button>
          <label className="btn-ghost cursor-pointer">
            Restaurează dintr-o copie
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0]).then(() => setRestoreMsg("Datele au fost restaurate."), (err) => setRestoreMsg((err as Error).message))} />
          </label>
          {session?.role === "owner" && (confirmReset ? (
            <span className="flex items-center gap-2 text-sm">
              Sigur? Modificările se pierd.
              <button className="btn-danger btn-sm" onClick={() => { void resetDemo(); setConfirmReset(false); }}>Da, reîncarcă datele demo</button>
              <button className="btn-ghost btn-sm" onClick={() => setConfirmReset(false)}>Renunț</button>
            </span>
          ) : <button className="btn-danger" onClick={() => setConfirmReset(true)}>Reîncarcă datele demo</button>)}
        </div>
        {restoreMsg && <div className="mt-4"><Notice tone="info">{restoreMsg}</Notice></div>}
      </Card>

      <Card title="Personal">
        <table className="table-lux">
          <thead><tr><th>Nume</th><th>E-mail</th><th>Rol</th></tr></thead>
          <tbody>{db.users.map((u) => <tr key={u.id}><td className="text-heading">{u.name}</td><td className="text-subtle">{u.email}</td><td>{ROLE_LABEL[u.role] ?? u.role}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-xs text-subtle">Conturile și parolele reale se gestionează în versiunea cu server (apps/admin), unde sesiunile sunt verificate de server.</p>
      </Card>
    </div>
  );
}

export function Account() {
  const session = useSession();
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader eyebrow={session ? ROLE_LABEL[session.role] : ""} title={session?.name ?? "Contul meu"} />
      <Card title="Sesiunea">
        <p className="text-sm text-subtle">Sunteți autentificat pe acest dispozitiv. Datele rămân în browser și după ieșire.</p>
        <button className="btn-ghost mt-4" onClick={() => setSession(null)}>Ieșire</button>
      </Card>
    </div>
  );
}

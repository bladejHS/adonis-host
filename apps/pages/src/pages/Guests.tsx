import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Card, Field, Notice, PageHeader, SourceTag, Stat, StatusBadge } from "@/components/ui";
import { useDb } from "../data/store";
import { updateGuest } from "../data/actions";
import { Empty, fmtLong, fmtRange, json, lei } from "../lib";

const valid = (s: string) => !["cancelled", "no_show"].includes(s);

export function Guests() {
  const db = useDb();
  const [sp, setSp] = useSearchParams();
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const tag = sp.get("tag") ?? "";
  const rows = db.guests
    .filter((g) => !q || [g.firstName, g.lastName, g.phone ?? "", g.email ?? ""].some((s) => s.toLowerCase().includes(q)))
    .filter((g) => !tag || json<string[]>(g.tags, []).includes(tag))
    .map((g) => {
      const res = db.reservations.filter((r) => r.guestId === g.id && valid(r.status));
      return { ...g, stays: res.length, spent: res.reduce((s, r) => s + r.totalAmount, 0), last: res.reduce<Date | null>((m, r) => (!m || r.checkIn > m ? r.checkIn : m), null), tagList: json<string[]>(g.tags, []) };
    })
    .sort((a, b) => b.stays - a.stays || (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0))
    .slice(0, 120);
  const filters = [["oaspete_fidel", "Oaspeți fideli"], ["familie_cu_copii", "Familii cu copii"], ["prefera_etaj_sus", "Preferă etaj sus"]];

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Oaspeți" description="Cine ne-a trecut pragul, ce preferă și cât de des revine." />
      <div className="flex flex-wrap items-center gap-3 pb-5">
        <label className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input id="guest-q" defaultValue={q} onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {})} placeholder="Nume, telefon sau e-mail" className="field pl-9" />
        </label>
        <div className="flex flex-wrap gap-2">
          {filters.map(([k, l]) => (
            <Link key={k} to={tag === k ? "/oaspeti" : `/oaspeti?tag=${k}`} className={`rounded-full border px-3 py-1 text-xs transition-colors ${tag === k ? "border-gold bg-gold-soft text-gold-text" : "border-line text-subtle hover:border-gold"}`}>{l}</Link>
          ))}
        </div>
      </div>
      <Card bodyClass="p-0 overflow-x-auto">
        {rows.length === 0 ? <Empty title="Niciun oaspete găsit" /> : (
          <table className="table-lux min-w-[760px]">
            <thead><tr><th>Oaspete</th><th>Contact</th><th>Etichete</th><th className="text-right">Sejururi</th><th>Ultima vizită</th><th className="text-right">Total cazare</th></tr></thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td><Link to={`/oaspeti/${g.id}`} className="font-medium text-heading hover:text-gold-text">{g.firstName} {g.lastName}</Link><p className="text-xs text-subtle">{g.city ?? "—"}</p></td>
                  <td className="text-xs text-subtle"><p className="num">{g.phone ?? "—"}</p><p>{g.email ?? ""}</p></td>
                  <td><div className="flex flex-wrap gap-1">{g.tagList.map((t) => <span key={t} className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.6875rem] text-gold-text">{t.replace(/_/g, " ")}</span>)}{g.allergies && <span className="rounded-full bg-error-soft px-2 py-0.5 text-[0.6875rem] text-error">alergii</span>}</div></td>
                  <td className="num text-right font-display text-xl text-heading">{g.stays}</td>
                  <td className="num text-sm">{g.last ? fmtLong(g.last) : "—"}</td>
                  <td className="num text-right">{lei(g.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function GuestDetail() {
  const { id } = useParams();
  const db = useDb();
  const g = db.guests.find((x) => x.id === id);
  if (!g) return <Empty title="Oaspetele nu există" />;
  const res = db.reservations.filter((r) => r.guestId === g.id).sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
  const ok = res.filter((r) => valid(r.status));
  const spent = ok.reduce((s, r) => s + r.totalAmount, 0);
  const nights = ok.reduce((s, r) => s + Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000), 0);
  const tags = json<string[]>(g.tags, []);
  return (
    <div className="space-y-8">
      <Link to="/oaspeti" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-heading"><ArrowLeft size={15} /> Toți oaspeții</Link>
      <PageHeader eyebrow={tags.includes("oaspete_fidel") ? "Oaspete fidel" : "Oaspete"} title={`${g.firstName} ${g.lastName}`} description={[g.city, g.phone, g.email].filter(Boolean).join(" · ")}>
        <Link to="/rezervari/noua" className="btn-primary">Rezervare nouă</Link>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sejururi" value={ok.length} tone="gold" />
        <Stat label="Nopți la Adonis" value={nights} />
        <Stat label="Total cazare" value={lei(spent)} />
        <Stat label="Tarif mediu" value={lei(nights ? spent / nights : 0)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Istoric sejururi" bodyClass="p-0 overflow-x-auto">
          <table className="table-lux min-w-[560px]">
            <thead><tr><th>Cod</th><th>Camera</th><th>Sejur</th><th>Canal</th><th>Stare</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {res.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/rezervari/${r.id}`} className="num text-xs text-gold-text hover:underline">{r.code}</Link></td>
                  <td className="num font-display text-lg text-heading">{db.rooms.find((x) => x.id === r.roomId)!.number}</td>
                  <td className="num whitespace-nowrap">{fmtRange(r.checkIn, r.checkOut)} {r.checkIn.getUTCFullYear()}</td>
                  <td><SourceTag source={r.source} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num text-right">{lei(r.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Fișa oaspetelui"><GuestForm id={g.id} /></Card>
      </div>
    </div>
  );
}

function GuestForm({ id }: { id: string }) {
  const db = useDb();
  const g = db.guests.find((x) => x.id === id)!;
  const [f, setF] = useState({
    firstName: g.firstName, lastName: g.lastName, phone: g.phone ?? "", email: g.email ?? "", city: g.city ?? "", country: g.country, idDocType: g.idDocType ?? "",
    idDocNumber: g.idDocNumber ?? "", allergies: g.allergies ?? "", preferences: g.preferences ?? "", notes: g.notes ?? "",
    tags: json<string[]>(g.tags, []).map((t) => t.replace(/_/g, " ")).join(", "), marketingOk: g.marketingOk,
  });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof typeof f, label: string, type = "text") => (
    <Field label={label}><input id={`g-${k}`} type={type} value={f[k] as string} onChange={(e) => set(k, e.target.value)} className="field" /></Field>
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const tags = f.tags.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
        updateGuest(id, { ...f, phone: f.phone || null, email: f.email || null, city: f.city || null, idDocType: f.idDocType || null, idDocNumber: f.idDocNumber || null, allergies: f.allergies || null, preferences: f.preferences || null, notes: f.notes || null, tags: JSON.stringify(tags) });
        setSaved(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {text("firstName", "Prenume")}{text("lastName", "Nume")}{text("phone", "Telefon")}{text("email", "E-mail", "email")}{text("city", "Oraș")}{text("country", "Țară")}
        <Field label="Act de identitate"><select id="g-doc" value={f.idDocType} onChange={(e) => set("idDocType", e.target.value)} className="field"><option value="">—</option><option value="CI">Carte de identitate</option><option value="pasaport">Pașaport</option></select></Field>
        {text("idDocNumber", "Serie și număr")}
      </div>
      <Field label="Etichete" hint="Separate prin virgulă. Ex: oaspete fidel, familie cu copii"><input id="g-tags" value={f.tags} onChange={(e) => set("tags", e.target.value)} className="field" /></Field>
      {text("allergies", "Alergii")}{text("preferences", "Preferințe")}
      <Field label="Note interne"><textarea id="g-notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="field" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.marketingOk} onChange={(e) => set("marketingOk", e.target.checked)} className="accent-[#c6a15b]" /> Acceptă oferte și noutăți (acord GDPR marketing)</label>
      {saved && <Notice tone="success">Fișa oaspetelui a fost actualizată.</Notice>}
      <button className="btn-primary">Salvează</button>
    </form>
  );
}

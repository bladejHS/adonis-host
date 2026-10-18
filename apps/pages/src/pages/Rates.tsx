import { useState } from "react";
import { Card, Field, PageHeader } from "@/components/ui";
import { useDb } from "../data/store";
import { createSeason, deleteSeason, updateBaseRate } from "../data/actions";
import { fmtLong, lei, parseDay, today } from "../lib";

export function Rates() {
  const db = useDb();
  const t = today();
  const seasons = [...db.seasons].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const upcoming = seasons.filter((s) => s.endDate >= t);
  const past = seasons.length - upcoming.length;
  const [f, setF] = useState({ name: "", startDate: "", endDate: "", multiplier: "1.2", minStay: "1", priority: "15", roomTypeId: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Tarife & sezoane" description="Prețul pe noapte = tariful de bază × multiplicatorul sezonului. Sezonul cu prioritatea cea mai mare câștigă când se suprapun." />
      <Card title="Tarif de bază pe tip de cameră" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[760px]">
          <thead><tr><th>Tip</th><th className="text-right">Camere</th><th className="text-right">Locuri</th><th>Tarif de bază</th>{upcoming.slice(0, 3).map((s) => <th key={s.id} className="text-right">{s.name}</th>)}</tr></thead>
          <tbody>
            {db.roomTypes.map((ty) => (
              <tr key={ty.id}>
                <td><p className="text-heading">{ty.name}</p><p className="text-xs text-subtle">{ty.code}</p></td>
                <td className="num text-right">{db.rooms.filter((r) => r.roomTypeId === ty.id).length}</td>
                <td className="num text-right">{ty.capacity}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <input id={`rate-${ty.id}`} type="number" step="5" defaultValue={ty.baseRate} onBlur={(e) => updateBaseRate(ty.id, Number(e.target.value))} className="field w-24 py-1.5" />
                    <span className="text-xs text-subtle">lei · se salvează la ieșirea din câmp</span>
                  </div>
                </td>
                {upcoming.slice(0, 3).map((s) => <td key={s.id} className="num text-right">{s.roomTypeId && s.roomTypeId !== ty.id ? "—" : lei(Math.round(ty.baseRate * s.multiplier))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Sezoane" bodyClass="p-0 overflow-x-auto">
          <table className="table-lux min-w-[640px]">
            <thead><tr><th>Sezon</th><th>Perioadă</th><th className="text-right">Multiplicator</th><th className="text-right">Minim nopți</th><th className="text-right">Prioritate</th><th /></tr></thead>
            <tbody>
              {upcoming.map((s) => (
                <tr key={s.id}>
                  <td><span className="mr-2 inline-block h-2 w-2 rotate-45" style={{ background: s.color ?? "#c6a15b" }} />{s.name}</td>
                  <td className="num whitespace-nowrap text-sm">{fmtLong(s.startDate)} – {fmtLong(s.endDate)}</td>
                  <td className="num text-right">×{s.multiplier.toFixed(2)}</td>
                  <td className="num text-right">{s.minStay}</td>
                  <td className="num text-right">{s.priority}</td>
                  <td className="text-right"><button className="text-xs text-subtle hover:text-error" onClick={() => deleteSeason(s.id)}>Șterge</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {past > 0 && <p className="px-5 py-3 text-xs text-subtle">{past} sezoane încheiate sunt păstrate pentru rapoarte.</p>}
        </Card>
        <Card title="Sezon nou">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createSeason({ name: f.name, startDate: parseDay(f.startDate), endDate: parseDay(f.endDate), multiplier: Number(f.multiplier) || 1, minStay: Math.max(1, Number(f.minStay)), priority: Number(f.priority), roomTypeId: f.roomTypeId || null });
              setF({ ...f, name: "", startDate: "", endDate: "" });
            }}
          >
            <Field label="Nume"><input id="s-name" required value={f.name} onChange={(e) => set("name", e.target.value)} className="field" placeholder="Ex: Zilele Costineștiului" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De la"><input id="s-from" type="date" required value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className="field" /></Field>
              <Field label="Până la (inclusiv)"><input id="s-to" type="date" required value={f.endDate} onChange={(e) => set("endDate", e.target.value)} className="field" /></Field>
              <Field label="Multiplicator"><input id="s-mult" type="number" step="0.05" value={f.multiplier} onChange={(e) => set("multiplier", e.target.value)} className="field" /></Field>
              <Field label="Minim nopți"><input id="s-min" type="number" min={1} value={f.minStay} onChange={(e) => set("minStay", e.target.value)} className="field" /></Field>
              <Field label="Prioritate"><input id="s-prio" type="number" value={f.priority} onChange={(e) => set("priority", e.target.value)} className="field" /></Field>
              <Field label="Doar pentru"><select id="s-type" value={f.roomTypeId} onChange={(e) => set("roomTypeId", e.target.value)} className="field"><option value="">Toate camerele</option>{db.roomTypes.map((ty) => <option key={ty.id} value={ty.id}>{ty.code}</option>)}</select></Field>
            </div>
            <button className="btn-primary">Adaugă sezonul</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

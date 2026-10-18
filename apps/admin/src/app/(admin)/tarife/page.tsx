import { prisma } from "@/lib/db";
import { fmtLong, lei, today } from "@/lib/format";
import { createSeason, deleteSeason, updateBaseRate } from "@/lib/actions";
import { Card, Field, PageHeader } from "@/components/ui";
import { Submit } from "@/components/submit";

export const metadata = { title: "Tarife & sezoane" };

export default async function Rates() {
  const t = today();
  const [types, seasons] = await Promise.all([
    prisma.roomType.findMany({ include: { _count: { select: { rooms: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.seasonRule.findMany({ include: { roomType: true }, orderBy: { startDate: "asc" } }),
  ]);
  const upcoming = seasons.filter((s) => s.endDate >= t);
  const past = seasons.filter((s) => s.endDate < t);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Tarife & sezoane" description="Prețul pe noapte = tariful de bază × multiplicatorul sezonului. Sezonul cu prioritatea cea mai mare câștigă când se suprapun." />

      <Card title="Tarif de bază pe tip de cameră" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[760px]">
          <thead><tr><th>Tip</th><th className="text-right">Camere</th><th className="text-right">Locuri</th><th>Tarif de bază</th>{upcoming.slice(0, 3).map((s) => <th key={s.id} className="text-right">{s.name}</th>)}</tr></thead>
          <tbody>
            {types.map((ty) => (
              <tr key={ty.id}>
                <td><p className="text-heading">{ty.name}</p><p className="text-xs text-subtle">{ty.code}</p></td>
                <td className="num text-right">{ty._count.rooms}</td>
                <td className="num text-right">{ty.capacity}</td>
                <td>
                  <form action={updateBaseRate} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={ty.id} />
                    <input name="baseRate" type="number" step="5" defaultValue={ty.baseRate} className="field w-24 py-1.5" />
                    <span className="text-xs text-subtle">lei</span>
                    <button className="btn-ghost btn-sm">Salvează</button>
                  </form>
                </td>
                {upcoming.slice(0, 3).map((s) => (
                  <td key={s.id} className="num text-right">{s.roomTypeId && s.roomTypeId !== ty.id ? "—" : lei(Math.round(ty.baseRate * s.multiplier))}</td>
                ))}
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
                  <td><span className="mr-2 inline-block h-2 w-2 rotate-45" style={{ background: s.color ?? "#c6a15b" }} />{s.name}{s.roomType && <span className="text-xs text-subtle"> · {s.roomType.code}</span>}</td>
                  <td className="num whitespace-nowrap text-sm">{fmtLong(s.startDate)} – {fmtLong(s.endDate)}</td>
                  <td className="num text-right">×{s.multiplier.toFixed(2)}</td>
                  <td className="num text-right">{s.minStay}</td>
                  <td className="num text-right">{s.priority}</td>
                  <td className="text-right"><form action={deleteSeason.bind(null, s.id)}><button className="text-xs text-subtle hover:text-error">Șterge</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
          {past.length > 0 && <p className="px-5 py-3 text-xs text-subtle">{past.length} sezoane încheiate sunt păstrate pentru rapoarte.</p>}
        </Card>

        <Card title="Sezon nou">
          <form action={createSeason} className="space-y-4">
            <Field label="Nume"><input name="name" required className="field" placeholder="Ex: Zilele Costineștiului" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De la"><input name="startDate" type="date" required className="field" /></Field>
              <Field label="Până la (inclusiv)"><input name="endDate" type="date" required className="field" /></Field>
              <Field label="Multiplicator"><input name="multiplier" type="number" step="0.05" defaultValue="1.2" className="field" /></Field>
              <Field label="Minim nopți"><input name="minStay" type="number" min={1} defaultValue={1} className="field" /></Field>
              <Field label="Prioritate"><input name="priority" type="number" defaultValue={15} className="field" /></Field>
              <Field label="Doar pentru">
                <select name="roomTypeId" className="field" defaultValue="">
                  <option value="">Toate camerele</option>
                  {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.code}</option>)}
                </select>
              </Field>
            </div>
            <Submit>Adaugă sezonul</Submit>
          </form>
        </Card>
      </div>
    </div>
  );
}

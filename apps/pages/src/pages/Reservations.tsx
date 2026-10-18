import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { RESERVATION_STATUS, SOURCE } from "@adonis/database/enums";
import { nightsBetween } from "@adonis/database/pricing";
import { Card, PageHeader, SourceTag, StatusBadge, Tabs } from "@/components/ui";
import { useDb } from "../data/store";
import { balanceOf } from "../data/actions";
import { Empty, fmtRange, lei, today } from "../lib";

const PER_PAGE = 30;

export function Reservations() {
  const db = useDb();
  const [sp, setSp] = useSearchParams();
  const t = today();
  const view = sp.get("view") ?? "viitoare";
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const status = sp.get("status") ?? "";
  const source = sp.get("source") ?? "";
  const page = Math.max(1, Number(sp.get("p") ?? 1));

  const guest = new Map(db.guests.map((g) => [g.id, g]));
  const room = new Map(db.rooms.map((r) => [r.id, r]));
  const type = new Map(db.roomTypes.map((x) => [x.id, x]));

  const views: Record<string, (r: (typeof db.reservations)[number]) => boolean> = {
    viitoare: (r) => r.checkIn >= t && r.status !== "cancelled",
    cazati: (r) => r.status === "checked_in",
    trecute: (r) => r.checkOut < t,
    anulate: (r) => ["cancelled", "no_show"].includes(r.status),
    toate: () => true,
  };
  let rows = db.reservations.filter(views[view] ?? views.toate);
  if (status) rows = rows.filter((r) => r.status === status);
  if (source) rows = rows.filter((r) => r.source === source);
  if (q) {
    rows = rows.filter((r) => {
      const g = guest.get(r.guestId)!;
      return [r.code, g.firstName, g.lastName, g.phone ?? "", room.get(r.roomId)!.number].some((s) => s.toLowerCase().includes(q));
    });
  }
  rows.sort((a, b) => (view === "trecute" || view === "toate" ? b.checkIn.getTime() - a.checkIn.getTime() : a.checkIn.getTime() - b.checkIn.getTime()));
  const pages = Math.ceil(rows.length / PER_PAGE);
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const count = (v: string) => db.reservations.filter(views[v]).length;
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("p" in patch)) next.delete("p");
    setSp(next);
  };

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Rezervări" description="Toate sejururile, din toate canalele, într-un singur loc.">
        <Link to="/rezervari/noua" className="btn-primary"><Plus size={16} strokeWidth={1.6} /> Rezervare nouă</Link>
      </PageHeader>
      <Tabs
        active={`/rezervari?view=${view}`}
        items={["viitoare", "cazati", "trecute", "anulate", "toate"].map((v) => ({ href: `/rezervari?view=${v}`, label: { viitoare: "Viitoare", cazati: "Cazați acum", trecute: "Încheiate", anulate: "Anulate", toate: "Toate" }[v]!, count: count(v) }))}
      />
      <div className="flex flex-wrap items-end gap-3 py-5">
        <label className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input id="q" defaultValue={sp.get("q") ?? ""} onChange={(e) => set({ q: e.target.value })} placeholder="Nume, telefon, cod ADN-… sau număr cameră" className="field pl-9" />
        </label>
        <select id="status" value={status} onChange={(e) => set({ status: e.target.value })} className="field w-auto">
          <option value="">Orice stare</option>
          {Object.entries(RESERVATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select id="source" value={source} onChange={(e) => set({ source: e.target.value })} className="field w-auto">
          <option value="">Orice canal</option>
          {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Card bodyClass="p-0 overflow-x-auto">
        {shown.length === 0 ? <Empty title="Nicio rezervare găsită">Încercați alt filtru sau adăugați o rezervare nouă.</Empty> : (
          <table className="table-lux min-w-[880px]">
            <thead><tr><th>Cod</th><th>Oaspete</th><th>Camera</th><th>Sejur</th><th>Canal</th><th>Stare</th><th className="text-right">Total</th><th className="text-right">Rest</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const g = guest.get(r.guestId)!;
                const rm = room.get(r.roomId)!;
                const due = balanceOf(db, r).due;
                return (
                  <tr key={r.id}>
                    <td><Link to={`/rezervari/${r.id}`} className="num text-xs text-gold-text hover:underline">{r.code}</Link></td>
                    <td><Link to={`/rezervari/${r.id}`} className="font-medium text-heading hover:text-gold-text">{g.firstName} {g.lastName}</Link><p className="text-xs text-subtle">{r.adults + r.children} pers.{g.phone ? ` · ${g.phone}` : ""}</p></td>
                    <td><span className="num font-display text-lg text-heading">{rm.number}</span><p className="text-xs text-subtle">{type.get(rm.roomTypeId)!.code}</p></td>
                    <td className="num whitespace-nowrap">{fmtRange(r.checkIn, r.checkOut)}<p className="text-xs text-subtle">{nightsBetween(r.checkIn, r.checkOut)} nopți</p></td>
                    <td><SourceTag source={r.source} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="num text-right">{lei(r.totalAmount)}</td>
                    <td className={`num text-right ${due > 0.5 && r.status !== "cancelled" ? "text-warning" : "text-subtle"}`}>{r.status === "cancelled" ? "—" : due > 0.5 ? lei(due) : "achitat"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {pages > 1 && (
        <nav className="flex items-center justify-between pt-5 text-sm text-subtle">
          <span className="num">{rows.length} rezervări · pagina {page} din {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <button className="btn-ghost btn-sm" onClick={() => set({ p: String(page - 1) })}>Înapoi</button>}
            {page < pages && <button className="btn-ghost btn-sm" onClick={() => set({ p: String(page + 1) })}>Înainte</button>}
          </div>
        </nav>
      )}
    </div>
  );
}

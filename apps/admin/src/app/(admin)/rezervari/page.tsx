import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma } from "@adonis/database";
import { RESERVATION_STATUS, SOURCE, nightsBetween } from "@adonis/database";
import { prisma } from "@/lib/db";
import { fmtRange, lei, today } from "@/lib/format";
import { Card, Empty, PageHeader, SourceTag, StatusBadge, Tabs } from "@/components/ui";

export const metadata = { title: "Rezervări" };

const PER_PAGE = 30;

export default async function Reservations({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const t = today();
  const view = searchParams.view ?? "viitoare";
  const page = Math.max(1, Number(searchParams.p ?? 1));
  const q = searchParams.q?.trim();

  const where: Prisma.ReservationWhereInput = {};
  if (view === "viitoare") Object.assign(where, { checkIn: { gte: t }, status: { notIn: ["cancelled"] } });
  if (view === "cazati") Object.assign(where, { status: "checked_in" });
  if (view === "trecute") Object.assign(where, { checkOut: { lt: t } });
  if (view === "anulate") Object.assign(where, { status: { in: ["cancelled", "no_show"] } });
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.source) where.source = searchParams.source;
  if (q)
    where.OR = [
      { code: { contains: q } },
      { guest: { lastName: { contains: q } } },
      { guest: { firstName: { contains: q } } },
      { guest: { phone: { contains: q } } },
      { room: { number: q } },
    ];

  const [rows, total, counts] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: { guest: true, room: { include: { roomType: true } } },
      orderBy: { checkIn: view === "trecute" || view === "toate" ? "desc" : "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.reservation.count({ where }),
    Promise.all([
      prisma.reservation.count({ where: { checkIn: { gte: t }, status: { notIn: ["cancelled"] } } }),
      prisma.reservation.count({ where: { status: "checked_in" } }),
      prisma.reservation.count({ where: { checkOut: { lt: t } } }),
      prisma.reservation.count({ where: { status: { in: ["cancelled", "no_show"] } } }),
      prisma.reservation.count(),
    ]),
  ]);

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, q, status: searchParams.status, source: searchParams.source, ...extra };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return `/rezervari?${p.toString()}`;
  };
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Rezervări" description="Toate sejururile, din toate canalele, într-un singur loc.">
        <Link href="/rezervari/noua" className="btn-primary">
          <Plus size={16} strokeWidth={1.6} /> Rezervare nouă
        </Link>
      </PageHeader>

      <Tabs
        active={`/rezervari?view=${view}`}
        items={[
          { href: "/rezervari?view=viitoare", label: "Viitoare", count: counts[0] },
          { href: "/rezervari?view=cazati", label: "Cazați acum", count: counts[1] },
          { href: "/rezervari?view=trecute", label: "Încheiate", count: counts[2] },
          { href: "/rezervari?view=anulate", label: "Anulate", count: counts[3] },
          { href: "/rezervari?view=toate", label: "Toate", count: counts[4] },
        ]}
      />

      <form className="flex flex-wrap items-end gap-3 py-5" action="/rezervari">
        <input type="hidden" name="view" value={view} />
        <label className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={q} placeholder="Nume, telefon, cod ADN-… sau număr cameră" className="field pl-9" />
        </label>
        <select name="status" defaultValue={searchParams.status ?? ""} className="field w-auto">
          <option value="">Orice stare</option>
          {Object.entries(RESERVATION_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="source" defaultValue={searchParams.source ?? ""} className="field w-auto">
          <option value="">Orice canal</option>
          {Object.entries(SOURCE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="btn-ghost">Caută</button>
      </form>

      <Card bodyClass="p-0 overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title="Nicio rezervare găsită">Încercați alt filtru sau adăugați o rezervare nouă.</Empty>
        ) : (
          <table className="table-lux min-w-[880px]">
            <thead>
              <tr>
                <th>Cod</th>
                <th>Oaspete</th>
                <th>Camera</th>
                <th>Sejur</th>
                <th>Canal</th>
                <th>Stare</th>
                <th className="text-right">Total</th>
                <th className="text-right">Rest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = r.totalAmount + r.touristTax - r.paidAmount;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/rezervari/${r.id}`} className="num text-xs text-gold-text hover:underline">{r.code}</Link>
                    </td>
                    <td>
                      <Link href={`/rezervari/${r.id}`} className="font-medium text-heading hover:text-gold-text">{r.guest.firstName} {r.guest.lastName}</Link>
                      <p className="text-xs text-subtle">{r.adults + r.children} pers.{r.guest.phone ? ` · ${r.guest.phone}` : ""}</p>
                    </td>
                    <td>
                      <span className="num font-display text-lg text-heading">{r.room.number}</span>
                      <p className="text-xs text-subtle">{r.room.roomType.code}</p>
                    </td>
                    <td className="num whitespace-nowrap">
                      {fmtRange(r.checkIn, r.checkOut)}
                      <p className="text-xs text-subtle">{nightsBetween(r.checkIn, r.checkOut)} nopți</p>
                    </td>
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
          <span className="num">{total} rezervări · pagina {page} din {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-ghost btn-sm" href={qs({ p: page - 1 })}>Înapoi</Link>}
            {page < pages && <Link className="btn-ghost btn-sm" href={qs({ p: page + 1 })}>Înainte</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}

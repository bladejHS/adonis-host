import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtLong, json, lei } from "@/lib/format";
import { Card, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Oaspeți" };

export default async function Guests({ searchParams }: { searchParams: { q?: string; tag?: string } }) {
  const q = searchParams.q?.trim();
  const guests = await prisma.guest.findMany({
    where: {
      ...(q ? { OR: [{ lastName: { contains: q } }, { firstName: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] } : {}),
      ...(searchParams.tag ? { tags: { contains: `"${searchParams.tag}"` } } : {}),
    },
    include: { reservations: { where: { status: { notIn: ["cancelled", "no_show"] } }, select: { checkIn: true, totalAmount: true } } },
    take: 400,
  });
  const rows = guests
    .map((g) => ({
      ...g,
      stays: g.reservations.length,
      spent: g.reservations.reduce((s, r) => s + r.totalAmount, 0),
      last: g.reservations.reduce<Date | null>((m, r) => (!m || r.checkIn > m ? r.checkIn : m), null),
      tagList: json<string[]>(g.tags, []),
    }))
    .sort((a, b) => b.stays - a.stays || (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0))
    .slice(0, 120);

  const tagFilters = [
    ["oaspete_fidel", "Oaspeți fideli"],
    ["familie_cu_copii", "Familii cu copii"],
    ["prefera_etaj_sus", "Preferă etaj sus"],
  ];

  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Oaspeți" description="Cine ne-a trecut pragul, ce preferă și cât de des revine." />
      <form className="flex flex-wrap items-center gap-3 pb-5" action="/oaspeti">
        <label className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input name="q" defaultValue={q} placeholder="Nume, telefon sau e-mail" className="field pl-9" />
        </label>
        <button className="btn-ghost">Caută</button>
        <div className="flex flex-wrap gap-2">
          {tagFilters.map(([k, l]) => (
            <Link key={k} href={searchParams.tag === k ? "/oaspeti" : `/oaspeti?tag=${k}`} className={`rounded-full border px-3 py-1 text-xs transition-colors ${searchParams.tag === k ? "border-gold bg-gold-soft text-gold-text" : "border-line text-subtle hover:border-gold"}`}>
              {l}
            </Link>
          ))}
        </div>
      </form>
      <Card bodyClass="p-0 overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title="Niciun oaspete găsit" />
        ) : (
          <table className="table-lux min-w-[760px]">
            <thead>
              <tr><th>Oaspete</th><th>Contact</th><th>Etichete</th><th className="text-right">Sejururi</th><th>Ultima vizită</th><th className="text-right">Total cazare</th></tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/oaspeti/${g.id}`} className="font-medium text-heading hover:text-gold-text">{g.firstName} {g.lastName}</Link>
                    <p className="text-xs text-subtle">{g.city ?? "—"}</p>
                  </td>
                  <td className="text-xs text-subtle"><p className="num">{g.phone ?? "—"}</p><p>{g.email ?? ""}</p></td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {g.tagList.map((t) => <span key={t} className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.6875rem] text-gold-text">{t.replace(/_/g, " ")}</span>)}
                      {g.allergies && <span className="rounded-full bg-error-soft px-2 py-0.5 text-[0.6875rem] text-error">alergii</span>}
                    </div>
                  </td>
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

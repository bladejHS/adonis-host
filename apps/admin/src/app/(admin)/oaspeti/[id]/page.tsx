import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtRange, json, lei } from "@/lib/format";
import { Card, PageHeader, SourceTag, StatusBadge, Stat } from "@/components/ui";
import { GuestForm } from "@/components/guest-form";

export default async function GuestDetail({ params }: { params: { id: string } }) {
  const g = await prisma.guest.findUnique({
    where: { id: params.id },
    include: { reservations: { include: { room: true }, orderBy: { checkIn: "desc" } }, consents: { orderBy: { createdAt: "desc" } } },
  });
  if (!g) notFound();
  const valid = g.reservations.filter((r) => !["cancelled", "no_show"].includes(r.status));
  const spent = valid.reduce((s, r) => s + r.totalAmount, 0);
  const nights = valid.reduce((s, r) => s + Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000), 0);
  const tags = json<string[]>(g.tags, []);

  return (
    <div className="space-y-8">
      <Link href="/oaspeti" className="inline-flex items-center gap-1.5 text-sm text-subtle hover:text-heading"><ArrowLeft size={15} /> Toți oaspeții</Link>
      <PageHeader eyebrow={tags.includes("oaspete_fidel") ? "Oaspete fidel" : "Oaspete"} title={`${g.firstName} ${g.lastName}`} description={[g.city, g.phone, g.email].filter(Boolean).join(" · ")}>
        <Link href={`/rezervari/noua`} className="btn-primary">Rezervare nouă</Link>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sejururi" value={valid.length} tone="gold" />
        <Stat label="Nopți la Adonis" value={nights} />
        <Stat label="Total cazare" value={lei(spent)} />
        <Stat label="Tarif mediu" value={lei(nights ? spent / nights : 0)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Istoric sejururi" bodyClass="p-0 overflow-x-auto">
          <table className="table-lux min-w-[560px]">
            <thead><tr><th>Cod</th><th>Camera</th><th>Sejur</th><th>Canal</th><th>Stare</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {g.reservations.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/rezervari/${r.id}`} className="num text-xs text-gold-text hover:underline">{r.code}</Link></td>
                  <td className="num font-display text-lg text-heading">{r.room.number}</td>
                  <td className="num whitespace-nowrap">{fmtRange(r.checkIn, r.checkOut)} {r.checkIn.getUTCFullYear()}</td>
                  <td><SourceTag source={r.source} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num text-right">{lei(r.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Fișa oaspetelui">
          <GuestForm
            g={{
              id: g.id, firstName: g.firstName, lastName: g.lastName, phone: g.phone ?? "", email: g.email ?? "", city: g.city ?? "", country: g.country,
              idDocType: g.idDocType ?? "", idDocNumber: g.idDocNumber ?? "", allergies: g.allergies ?? "", preferences: g.preferences ?? "", notes: g.notes ?? "",
              tags: tags.map((t) => t.replace(/_/g, " ")).join(", "), marketingOk: g.marketingOk,
            }}
          />
        </Card>
      </div>
    </div>
  );
}

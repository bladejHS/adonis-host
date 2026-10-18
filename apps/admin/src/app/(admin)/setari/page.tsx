import { ROLE_LABEL, type Role } from "@adonis/core/auth";
import { smartbillConfigured, whatsappConfigured } from "@adonis/core";
import { prisma } from "@/lib/db";
import { fmtDateTime, isoDay, today } from "@/lib/format";
import { toggleUser } from "@/lib/actions";
import { getSession } from "@/lib/session";
import { Card, Field, PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";
import { NewUserForm } from "@/components/account-forms";

export const metadata = { title: "Setări" };

export default async function Settings() {
  const [p, users, session] = await Promise.all([prisma.property.findFirstOrThrow(), prisma.user.findMany({ orderBy: { createdAt: "asc" } }), getSession()]);
  const { createdAt, updatedAt, ...plain } = p;
  void createdAt;
  void updatedAt;
  const t = today();
  const monthStart = isoDay(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)));
  const integrations = [
    ["Plăți Stripe", Boolean(process.env.STRIPE_SECRET_KEY), "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"],
    ["Plăți Netopia", Boolean(process.env.NETOPIA_API_KEY), "NETOPIA_API_KEY, NETOPIA_POS_SIGNATURE"],
    ["SmartBill / e-Factura", smartbillConfigured(), "SMARTBILL_EMAIL, SMARTBILL_TOKEN, SMARTBILL_CIF"],
    ["WhatsApp Business", whatsappConfigured(), "WHATSAPP_TOKEN, WHATSAPP_PHONE_ID"],
    ["Stocare Cloudflare R2", Boolean(process.env.R2_BUCKET), "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET"],
  ] as const;

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader eyebrow="Administrare" title="Setări" description="Datele care apar pe facturi, în mesajele către oaspeți și în calculul taxelor." />
      <PropertyForm p={plain} />

      <Card title="Exporturi">
        <div className="grid gap-6 md:grid-cols-2">
          <form action="/api/export/registru" className="space-y-3">
            <p className="text-heading">Evidența turiștilor</p>
            <p className="text-sm text-subtle">Rubricile fișei de anunțare a sosirii și plecării, din datele de la check-in. CSV pentru Excel.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="De la"><input type="date" name="from" defaultValue={monthStart} className="field" /></Field>
              <Field label="Până la"><input type="date" name="to" defaultValue={isoDay(t)} className="field" /></Field>
            </div>
            <button className="btn-ghost">Descarcă CSV</button>
          </form>
          <form action="/api/export/raport" className="space-y-3">
            <p className="text-heading">Raport anual pe luni</p>
            <p className="text-sm text-subtle">Ocupare, nopți, venit, ADR, RevPAR, anulări — pentru contabil sau bancă.</p>
            <Field label="Anul"><input type="number" name="an" defaultValue={t.getUTCFullYear()} className="field w-32" /></Field>
            <button className="btn-ghost">Descarcă CSV</button>
          </form>
        </div>
      </Card>

      <Card title="Integrări">
        <ul className="divide-y divide-line text-sm">
          {integrations.map(([name, on, vars]) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-heading">{name}</span>
              <span className={on ? "text-success" : "text-subtle"}>{on ? "Conectat" : <>Neconfigurat · <code className="text-xs">{vars}</code></>}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">Cheile se pun în variabilele de mediu ale serverului (vezi docs/deployment.md), niciodată în cod.</p>
      </Card>

      {session?.role === "owner" && (
        <Card title="Personal">
          <table className="table-lux mb-6">
            <thead><tr><th>Nume</th><th>E-mail</th><th>Rol</th><th>Ultima autentificare</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td className="text-heading">{u.name}</td>
                  <td className="text-subtle">{u.email}</td>
                  <td>{ROLE_LABEL[u.role as Role] ?? u.role}</td>
                  <td className="num text-sm text-subtle">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "niciodată"}</td>
                  <td className="text-right">
                    {u.id !== session.uid && (
                      <form action={toggleUser.bind(null, u.id, !u.active)}><button className="btn-ghost btn-sm">{u.active ? "Dezactivează" : "Reactivează"}</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <NewUserForm />
        </Card>
      )}
    </div>
  );
}

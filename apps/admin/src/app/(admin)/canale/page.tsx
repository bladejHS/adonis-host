import { prisma } from "@/lib/db";
import { fmtDateTime, relTime } from "@/lib/format";
import { saveChannelLink, updateChannel } from "@/lib/actions";
import { Card, Field, Notice, PageHeader, sourceColor } from "@/components/ui";
import { SyncButton } from "@/components/sync-button";
import { Submit } from "@/components/submit";

export const metadata = { title: "Canale & sincronizare" };

export default async function Channels() {
  const [channels, logs, rooms] = await Promise.all([
    prisma.channel.findMany({ include: { roomLinks: { include: { room: true }, orderBy: { room: { number: "asc" } } }, _count: { select: { reservations: true } } } }),
    prisma.channelSyncLog.findMany({ include: { channel: true }, orderBy: { startedAt: "desc" }, take: 12 }),
    prisma.room.findMany({ orderBy: { number: "asc" } }),
  ]);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const synced = channels.filter((c) => c.syncType !== "none");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Canale & sincronizare" description="Booking.com și Airbnb se sincronizează prin calendare iCal. Conexiunea XML cu Booking.com se adaugă după aprobare, fără să schimbăm nimic aici." />

      <div className="grid gap-6 lg:grid-cols-2">
        {channels.map((c) => (
          <section key={c.id} className="card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rotate-45" style={{ background: sourceColor[c.kind] ?? "#8c8170" }} />
                <h2 className="text-xl">{c.name}</h2>
              </div>
              <span className="text-xs text-subtle">{c._count.reservations} rezervări · {c.syncType === "ical" ? "iCal" : c.syncType === "xml" ? "XML" : "fără sincronizare"}</span>
            </header>
            <div className="space-y-4 p-5">
              {c.syncType !== "none" ? (
                <>
                  <p className="text-sm">
                    Ultima sincronizare: {c.lastSyncAt ? <span className="text-heading">{relTime(c.lastSyncAt)}</span> : "niciodată"}
                    {c.lastSyncStatus && <span className={c.lastSyncStatus === "ok" ? " text-success" : " text-warning"}> · {c.lastSyncStatus === "ok" ? "reușită" : c.lastSyncStatus === "partial" ? "parțială" : "eșuată"}</span>}
                  </p>
                  <SyncButton channelId={c.id} />
                  <form action={updateChannel} className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                    <input type="hidden" name="id" value={c.id} />
                    <Field label="Interval (min)"><input name="syncIntervalMin" type="number" min={5} defaultValue={c.syncIntervalMin} className="field" /></Field>
                    <Field label="Comision (%)"><input name="commissionPct" type="number" step="0.5" defaultValue={c.commissionPct} className="field" /></Field>
                    <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} className="accent-[#c6a15b]" /> Activ</label>
                    <Submit className="btn-ghost">Salvează</Submit>
                  </form>
                  <details className="border-t border-line pt-4">
                    <summary className="cursor-pointer text-sm text-gold-text">Linkuri iCal pe camere ({c.roomLinks.filter((l) => l.importUrl).length} din {c.roomLinks.length} completate)</summary>
                    <p className="mt-3 text-xs text-subtle">
                      {c.kind === "booking"
                        ? "În extranetul Booking: Tarife și disponibilitate → Sincronizare calendare → Exportă calendar. Copiați linkul fiecărei camere aici."
                        : "În Airbnb: Calendar → Disponibilitate → Conectează calendare → Exportă calendar."}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {c.roomLinks.map((l) => (
                        <li key={l.id}>
                          <form action={saveChannelLink} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={l.id} />
                            <span className="num w-8 font-display text-lg text-heading">{l.room.number}</span>
                            <input name="importUrl" defaultValue={l.importUrl ?? ""} placeholder="https://…ics" className="field py-1.5 text-xs" />
                            <button className="btn-ghost btn-sm">Salvează</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p className="text-sm text-subtle">Rezervările se introduc de recepție. Sunt incluse automat în calendarele exportate către Booking și Airbnb.</p>
              )}
            </div>
          </section>
        ))}
      </div>

      <Card title="Calendare exportate de Adonis" bodyClass="p-0 overflow-x-auto">
        <p className="px-5 pt-4 text-sm text-subtle">Lipiți aceste linkuri în Booking.com și Airbnb („Importă calendar”), ca rezervările directe și cele de pe celălalt canal să blocheze automat camera. Pe producție, linkul va folosi domeniul public.</p>
        <table className="table-lux mt-3 min-w-[640px]">
          <thead><tr><th>Camera</th><th>Link iCal</th></tr></thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td className="num font-display text-lg text-heading">{r.number}</td>
                <td><code className="num break-all text-xs text-subtle">{base}/api/ical/{r.icalExportToken}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Jurnal de sincronizare" bodyClass="p-0 overflow-x-auto">
        {synced.length > 0 && logs.length === 0 && <div className="p-5"><Notice>Nicio sincronizare încă.</Notice></div>}
        <table className="table-lux min-w-[720px]">
          <thead><tr><th>Când</th><th>Canal</th><th>Rezultat</th><th className="text-right">Noi</th><th className="text-right">Modificate</th><th className="text-right">Anulate</th><th className="text-right">Suprapuneri</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="num whitespace-nowrap text-sm">{fmtDateTime(l.startedAt)}</td>
                <td>{l.channel.name}</td>
                <td className={`text-sm ${l.status === "ok" ? "text-success" : l.status === "partial" ? "text-warning" : "text-error"}`}>{l.message}</td>
                <td className="num text-right">{l.created}</td>
                <td className="num text-right">{l.updated}</td>
                <td className="num text-right">{l.cancelled}</td>
                <td className={`num text-right ${l.conflicts ? "text-error" : ""}`}>{l.conflicts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

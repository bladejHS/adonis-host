import { useState } from "react";
import { buildIcs } from "@adonis/core/pure";
import { Card, Field, Notice, PageHeader, sourceColor } from "@/components/ui";
import { useDb } from "../data/store";
import { importIcs } from "../data/actions";
import { download, fmtDateTime, relTime, today } from "../lib";

export function Channels() {
  const db = useDb();
  const synced = db.channels.filter((c) => c.syncType !== "none");
  const [channelId, setChannelId] = useState(synced[0]?.id ?? "");
  const [roomId, setRoomId] = useState(db.rooms[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);
  const logs = [...db.syncLogs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, 12);

  const exportRoom = (id: string) => {
    const room = db.rooms.find((r) => r.id === id)!;
    const t = today();
    const blocks = [
      ...db.reservations.filter((r) => r.roomId === id && !["cancelled", "no_show"].includes(r.status) && r.checkOut >= t).map((r) => ({ uid: `${r.id}@adonis-host`, start: r.checkIn, end: r.checkOut, summary: "Ocupat - Adonis" })),
      ...db.overrides.filter((o) => o.roomId === id && o.endDate >= t).map((o) => ({ uid: `${o.id}@adonis-host`, start: o.startDate, end: o.endDate, summary: "Indisponibil" })),
    ];
    download(`adonis-camera-${room.number}.ics`, buildIcs(room.number, blocks), "text/calendar;charset=utf-8");
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administrare" title="Canale & sincronizare" description="Booking.com și Airbnb comunică prin calendare iCal. În versiunea Pages importați fișierul .ics descărcat din extranet; versiunea cu server îl citește automat la 15 minute." />

      <div className="grid gap-6 lg:grid-cols-2">
        {db.channels.map((c) => (
          <section key={c.id} className="card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3"><span className="h-3 w-3 rotate-45" style={{ background: sourceColor[c.kind] ?? "#8c8170" }} /><h2 className="text-xl">{c.name}</h2></div>
              <span className="text-xs text-subtle">{db.reservations.filter((r) => r.channelId === c.id).length} rezervări · {c.syncType === "ical" ? "iCal" : "fără sincronizare"}</span>
            </header>
            <div className="space-y-2 p-5 text-sm">
              {c.syncType !== "none" ? (
                <>
                  <p>Ultima sincronizare: {c.lastSyncAt ? <span className="text-heading">{relTime(c.lastSyncAt)}</span> : "niciodată"}</p>
                  <p className="text-subtle">Comision {c.commissionPct}% · interval {c.syncIntervalMin} min (versiunea cu server)</p>
                </>
              ) : <p className="text-subtle">Rezervările se introduc de recepție și sunt incluse în calendarele exportate.</p>}
            </div>
          </section>
        ))}
      </div>

      <Card title="Importă calendarul unei camere (.ics)">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr] md:items-end">
          <Field label="Canal"><select id="c-ch" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="field">{synced.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Camera"><select id="c-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="field">{db.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</select></Field>
          <Field label="Fișier .ics" hint="Booking: Tarife și disponibilitate → Sincronizare calendare → Exportă. Airbnb: Calendar → Disponibilitate → Exportă.">
            <input
              id="c-file"
              type="file"
              accept=".ics,text/calendar"
              className="field"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = importIcs(channelId, roomId, await file.text());
                setResult(`${r.events} evenimente citite: ${r.created} rezervări noi, ${r.updated} modificate, ${r.cancelled} anulate${r.conflicts ? `, ${r.conflicts} suprapuneri (vezi alertele)` : ""}.`);
                e.target.value = "";
              }}
            />
          </Field>
        </div>
        {result && <div className="mt-4"><Notice tone="success">{result}</Notice></div>}
      </Card>

      <Card title="Calendare exportate de Adonis" bodyClass="p-0">
        <p className="px-5 pt-4 text-sm text-subtle">Descărcați calendarul fiecărei camere și importați-l în Booking și Airbnb, ca rezervările directe să blocheze camera. Cu versiunea pe server, linkul se actualizează singur.</p>
        <div className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-6 lg:grid-cols-8">
          {db.rooms.map((r) => <button key={r.id} className="btn-ghost btn-sm" onClick={() => exportRoom(r.id)}>Camera {r.number}</button>)}
        </div>
      </Card>

      <Card title="Jurnal de sincronizare" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[720px]">
          <thead><tr><th>Când</th><th>Canal</th><th>Rezultat</th><th className="text-right">Noi</th><th className="text-right">Modificate</th><th className="text-right">Anulate</th><th className="text-right">Suprapuneri</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="num whitespace-nowrap text-sm">{fmtDateTime(l.startedAt)}</td>
                <td>{db.channels.find((c) => c.id === l.channelId)?.name}</td>
                <td className={`text-sm ${l.status === "ok" ? "text-success" : l.status === "partial" ? "text-warning" : "text-error"}`}>{l.message}</td>
                <td className="num text-right">{l.created}</td><td className="num text-right">{l.updated}</td><td className="num text-right">{l.cancelled}</td>
                <td className={`num text-right ${l.conflicts ? "text-error" : ""}`}>{l.conflicts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

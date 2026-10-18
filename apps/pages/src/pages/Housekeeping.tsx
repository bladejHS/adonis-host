import { useState } from "react";
import { TASK_STATUS, TASK_TYPE } from "@adonis/database/enums";
import { Card, Field, HousekeepingBadge, PageHeader, TaskBadge } from "@/components/ui";
import { useDb, useSession } from "../data/store";
import { advanceTask, createTask } from "../data/actions";
import { addDays, fmtShort, isoDay, parseDay, today } from "../lib";

const NEXT: Record<string, [string, string] | null> = { todo: ["in_progress", "Încep"], in_progress: ["done", "Gata"], done: ["verified", "Verificat"], verified: null };
const PRIO: Record<string, number> = { high: 0, normal: 1, low: 2 };

export function Housekeeping() {
  const db = useDb();
  const session = useSession();
  const t = today();
  const staff = db.users.filter((u) => u.active && ["housekeeping", "maintenance"].includes(u.role));
  const tasks = db.tasks.filter((x) => ["todo", "in_progress"].includes(x.status) || (x.completedAt && x.completedAt > addDays(t, -1)) || (x.dueDate >= t && x.dueDate < addDays(t, 2)));
  const [form, setForm] = useState({ roomId: db.rooms[0]?.id ?? "", dueDate: isoDay(t), type: "checkout_clean", assigneeId: "", priority: "normal", notes: "" });
  const set = (k: keyof typeof form, v: string) => setForm((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Casă" title="Curățenie" description="Camerele care se eliberează apar aici automat la check-out. Când o curățenie e gata, camera trece la verificare." />
      <div className="grid gap-4 lg:grid-cols-4">
        {(["todo", "in_progress", "done", "verified"] as const).map((c) => {
          const list = tasks.filter((x) => x.status === c).sort((a, b) => PRIO[a.priority] - PRIO[b.priority]);
          return (
            <section key={c} className="rounded border border-line bg-muted/50">
              <header className="flex items-center justify-between border-b border-line px-4 py-3"><TaskBadge status={c} /><span className="num text-sm text-subtle">{list.length}</span></header>
              <ul className="space-y-3 p-3">
                {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-subtle">Nimic aici</li>}
                {list.map((task) => {
                  const room = db.rooms.find((r) => r.id === task.roomId)!;
                  const next = NEXT[task.status];
                  const who = db.users.find((u) => u.id === task.assigneeId)?.name ?? task.assignee ?? "Neasignat";
                  return (
                    <li key={task.id} className="card space-y-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="num font-display text-2xl leading-none text-heading">{room.number}</p><p className="mt-1 text-sm">{TASK_TYPE[task.type as keyof typeof TASK_TYPE]}</p></div>
                        {task.priority === "high" && <span className="rounded-full bg-error-soft px-2 py-0.5 text-[0.6875rem] text-error">urgent</span>}
                      </div>
                      <p className="text-xs text-subtle">{who} · {task.dueDate.getTime() === t.getTime() ? "azi" : fmtShort(task.dueDate)}{task.minutesSpent ? ` · ${task.minutesSpent} min` : ""}</p>
                      {task.notes && <p className="text-xs italic text-subtle">{task.notes}</p>}
                      {next && <button className="btn-ghost btn-sm w-full" onClick={() => advanceTask(task.id, next[0], session?.uid)}>{next[1]}</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title="Starea camerelor">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {db.rooms.map((r) => <div key={r.id} className="rounded-sm border border-line p-2.5"><p className="num font-display text-xl text-heading">{r.number}</p><div className="mt-1.5"><HousekeepingBadge status={r.housekeeping} /></div></div>)}
          </div>
        </Card>
        <Card title="Sarcină nouă">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createTask({ ...form, assigneeId: form.assigneeId || null, dueDate: parseDay(form.dueDate), notes: form.notes || null }); set("notes", ""); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Camera"><select id="t-room" value={form.roomId} onChange={(e) => set("roomId", e.target.value)} className="field">{db.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</select></Field>
              <Field label="Termen"><input id="t-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="field" /></Field>
            </div>
            <Field label="Tip"><select id="t-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="field">{Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cine"><select id="t-who" value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} className="field"><option value="">Oricine din echipă</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="Prioritate"><select id="t-prio" value={form.priority} onChange={(e) => set("priority", e.target.value)} className="field"><option value="high">Urgentă</option><option value="normal">Normală</option><option value="low">Când se poate</option></select></Field>
            </div>
            <Field label="Detalii"><textarea id="t-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="field" /></Field>
            <button className="btn-primary">Adaugă sarcina</button>
          </form>
          <p className="mt-4 text-xs text-subtle">Stări: {Object.values(TASK_STATUS).join(" → ")}. La „Gata” după o curățenie de plecare, consumabilele standard se scad singure din stoc.</p>
        </Card>
      </div>
    </div>
  );
}

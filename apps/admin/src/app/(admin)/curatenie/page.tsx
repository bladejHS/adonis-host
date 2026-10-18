import { TASK_STATUS, TASK_TYPE } from "@adonis/database";
import { prisma } from "@/lib/db";
import { addDays, fmtShort, isoDay, today } from "@/lib/format";
import { advanceTask, createTask } from "@/lib/actions";
import { Card, Field, HousekeepingBadge, PageHeader, TaskBadge } from "@/components/ui";
import { Submit } from "@/components/submit";

export const metadata = { title: "Curățenie" };

const NEXT: Record<string, [string, string] | null> = {
  todo: ["in_progress", "Încep"],
  in_progress: ["done", "Gata"],
  done: ["verified", "Verificat"],
  verified: null,
};

export default async function Housekeeping() {
  const t = today();
  const [tasks, rooms] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where: { OR: [{ status: { in: ["todo", "in_progress"] } }, { completedAt: { gte: addDays(t, -1) } }, { dueDate: { gte: t, lt: addDays(t, 2) } }] },
      include: { room: true },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    }),
    prisma.room.findMany({ orderBy: { number: "asc" } }),
  ]);
  const columns = ["todo", "in_progress", "done", "verified"] as const;
  const prioWeight = { high: 0, normal: 1, low: 2 } as Record<string, number>;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Casă" title="Curățenie" description="Camerele care se eliberează azi apar aici automat. Când o curățenie e gata, camera trece la verificare." />

      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map((c) => {
          const list = tasks.filter((x) => x.status === c).sort((a, b) => prioWeight[a.priority] - prioWeight[b.priority]);
          return (
            <section key={c} className="rounded border border-line bg-muted/50">
              <header className="flex items-center justify-between border-b border-line px-4 py-3">
                <TaskBadge status={c} />
                <span className="num text-sm text-subtle">{list.length}</span>
              </header>
              <ul className="space-y-3 p-3">
                {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-subtle">Nimic aici</li>}
                {list.map((task) => {
                  const next = NEXT[task.status];
                  return (
                    <li key={task.id} className="card space-y-2 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="num font-display text-2xl leading-none text-heading">{task.room.number}</p>
                          <p className="mt-1 text-sm">{TASK_TYPE[task.type as keyof typeof TASK_TYPE]}</p>
                        </div>
                        {task.priority === "high" && <span className="rounded-full bg-error-soft px-2 py-0.5 text-[0.6875rem] text-error">urgent</span>}
                      </div>
                      <p className="text-xs text-subtle">
                        {task.assignee ?? "Neasignat"} · {task.dueDate.getTime() === t.getTime() ? "azi" : fmtShort(task.dueDate)}
                      </p>
                      {task.notes && <p className="text-xs italic text-subtle">{task.notes}</p>}
                      {next && (
                        <form action={advanceTask.bind(null, task.id, next[0])}>
                          <button className="btn-ghost btn-sm w-full">{next[1]}</button>
                        </form>
                      )}
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
            {rooms.map((r) => (
              <div key={r.id} className="rounded-sm border border-line p-2.5">
                <p className="num font-display text-xl text-heading">{r.number}</p>
                <div className="mt-1.5"><HousekeepingBadge status={r.housekeeping} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Sarcină nouă">
          <form action={createTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Camera">
                <select name="roomId" className="field" required>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
                </select>
              </Field>
              <Field label="Termen"><input type="date" name="dueDate" defaultValue={isoDay(t)} className="field" required /></Field>
            </div>
            <Field label="Tip">
              <select name="type" className="field">
                {Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cine"><input name="assignee" className="field" placeholder="Mariana" /></Field>
              <Field label="Prioritate">
                <select name="priority" className="field" defaultValue="normal">
                  <option value="high">Urgentă</option>
                  <option value="normal">Normală</option>
                  <option value="low">Când se poate</option>
                </select>
              </Field>
            </div>
            <Field label="Detalii"><textarea name="notes" rows={2} className="field" /></Field>
            <Submit>Adaugă sarcina</Submit>
          </form>
          <p className="mt-4 text-xs text-subtle">Aplicația mobilă pentru personal (fotografii, notificări, consumabile) vine în Faza 4. Stări posibile: {Object.values(TASK_STATUS).join(" → ")}.</p>
        </Card>
      </div>
    </div>
  );
}

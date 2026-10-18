import { useState } from "react";
import { Card, PageHeader, Stat } from "@/components/ui";
import { useDb, useSession } from "../data/store";
import { adjustStock } from "../data/actions";
import { fmtDateTime } from "../lib";

const CATEGORY: Record<string, string> = { lenjerie: "Lenjerie", prosoape: "Prosoape", igiena: "Igienă", curatenie: "Curățenie", minibar: "Minibar" };
const REASON: Record<string, string> = { checkout_clean: "Curățenie la plecare", restock: "Aprovizionare", adjustment: "Corecție inventar", damage: "Deteriorat" };

export function Inventory() {
  const db = useDb();
  const low = db.inventory.filter((i) => i.stock <= i.minStock);
  const movements = [...db.movements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 25);
  const checkouts = db.tasks.filter((x) => x.type === "checkout_clean" && ["done", "verified"].includes(x.status) && x.completedAt && x.completedAt.getTime() > Date.now() - 30 * 86_400_000).length;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Casă" title="Consumabile" description="La fiecare curățenie de plecare terminată, stocul scade automat cu consumul standard al unei camere." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Articole sub minim" value={low.length} tone="gold" hint={low.map((i) => i.name).join(", ") || "toate în regulă"} />
        <Stat label="Curățenii de plecare (30 zile)" value={checkouts} />
        <Stat label="Articole urmărite" value={db.inventory.length} />
      </div>
      <Card title="Stoc" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[760px]">
          <thead><tr><th>Articol</th><th>Categorie</th><th className="text-right">Stoc</th><th className="text-right">Minim</th><th className="text-right">Consum / plecare</th><th>Mișcare</th></tr></thead>
          <tbody>
            {db.inventory.map((i) => (
              <tr key={i.id}>
                <td className="text-heading">{i.name}</td>
                <td className="text-subtle">{CATEGORY[i.category] ?? i.category}</td>
                <td className={`num text-right font-display text-xl ${i.stock <= i.minStock ? "text-error" : "text-heading"}`}>{Math.round(i.stock * 10) / 10} <span className="font-sans text-xs text-subtle">{i.unit}</span></td>
                <td className="num text-right text-subtle">{i.minStock}</td>
                <td className="num text-right text-subtle">{i.perCheckout}</td>
                <td><Move itemId={i.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-xs text-subtle">Pentru consum sau deteriorare, scrieți cantitatea cu minus (ex: -2).</p>
      </Card>
      <Card title="Ultimele mișcări" bodyClass="p-0 overflow-x-auto">
        <table className="table-lux min-w-[560px]">
          <thead><tr><th>Când</th><th>Articol</th><th>Motiv</th><th>Cine</th><th className="text-right">Cantitate</th></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="num text-sm">{fmtDateTime(m.createdAt)}</td>
                <td>{db.inventory.find((i) => i.id === m.itemId)?.name}</td>
                <td className="text-subtle">{REASON[m.reason] ?? m.reason}</td>
                <td className="text-subtle">{db.users.find((u) => u.id === m.userId)?.name ?? "—"}</td>
                <td className={`num text-right ${m.quantity < 0 ? "text-subtle" : "text-success"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Move({ itemId }: { itemId: string }) {
  const session = useSession();
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("restock");
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); adjustStock(itemId, Number(q), reason, session?.uid); setQ(""); }}>
      <input id={`q-${itemId}`} type="number" step="0.5" placeholder="+20" value={q} onChange={(e) => setQ(e.target.value)} className="field w-20 py-1.5" />
      <select id={`r-${itemId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="field w-auto py-1.5"><option value="restock">Aprovizionare</option><option value="adjustment">Corecție</option><option value="damage">Deteriorat</option></select>
      <button className="btn-ghost btn-sm">Salvează</button>
    </form>
  );
}

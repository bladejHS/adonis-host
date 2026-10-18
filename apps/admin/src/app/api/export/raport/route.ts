import { monthlySeries, toCsv } from "@adonis/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !["owner", "manager"].includes(s.role)) return new Response("Acces interzis", { status: 403 });
  const year = Number(new URL(req.url).searchParams.get("an") ?? new Date().getUTCFullYear());
  const months = await monthlySeries(year, Array.from({ length: 12 }, (_, i) => i + 1));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rows = months.map((m) => ({
    luna: MONTHS[m.month - 1], ocupare: `${Math.round(m.occupancy * 1000) / 10}%`, nopti: m.sold, disponibile: m.available,
    venit: r2(m.revenue), adr: r2(m.adr), revpar: r2(m.revpar), sosiri: m.bookings, anulari: `${Math.round(m.cancellationRate * 1000) / 10}%`,
  }));
  const csv = toCsv(rows, { luna: "Luna", ocupare: "Ocupare", nopti: "Nopți vândute", disponibile: "Nopți disponibile", venit: "Venit cazare (lei)", adr: "ADR (lei)", revpar: "RevPAR (lei)", sosiri: "Sosiri", anulari: "Anulări" });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="raport-adonis-${year}.csv"` } });
}

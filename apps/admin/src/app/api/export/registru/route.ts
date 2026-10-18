import { REGISTRY_HEADERS, registryRows, toCsv } from "@adonis/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !["owner", "manager", "reception"].includes(s.role)) return new Response("Acces interzis", { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 8) + "01";
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const rows = await registryRows(new Date(from + "T00:00:00Z"), new Date(new Date(to + "T00:00:00Z").getTime() + 86_400_000));
  return new Response(toCsv(rows, REGISTRY_HEADERS), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="evidenta-turisti-${from}_${to}.csv"` },
  });
}

import { invoiceToUbl } from "@adonis/core";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || !["owner", "manager", "reception"].includes(s.role)) return new Response("Acces interzis", { status: 403 });
  const inv = await prisma.invoice.findUnique({ where: { id: params.id }, include: { guest: true } });
  if (!inv) return new Response("Factura nu există", { status: 404 });
  const property = await prisma.property.findFirstOrThrow();
  return new Response(invoiceToUbl(inv, property, inv.guest), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${inv.series}${String(inv.number).padStart(5, "0")}.xml"` },
  });
}

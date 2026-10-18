import { readStoredFile } from "@adonis/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Acte de identitate, semnături, poze de daune. Doar pentru personal autentificat (middleware + verificare aici).
export async function GET(_: Request, { params }: { params: { key: string[] } }) {
  const s = await getSession();
  if (!s) return new Response("Neautorizat", { status: 401 });
  const key = params.key.join("/");
  if (key.startsWith("checkin/") && !["owner", "manager", "reception"].includes(s.role)) return new Response("Acces interzis", { status: 403 });
  const file = await readStoredFile(key);
  if (!file) return new Response("Fișier inexistent", { status: 404 });
  return new Response(file.data, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=300" } });
}

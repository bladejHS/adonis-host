import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Role } from "@adonis/core/auth";

export async function getSession() {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** Verificare pe server (middleware-ul filtrează paginile; aici protejăm și acțiunile). */
export async function requireSession(roles?: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (roles && !roles.includes(s.role) && s.role !== "owner") throw new Error("Rolul dumneavoastră nu are voie să facă această modificare.");
  return s;
}

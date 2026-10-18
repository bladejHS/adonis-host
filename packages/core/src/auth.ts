// Autentificare personal: parole scrypt + sesiuni JWT (HS256).
// Fără dependențe Node în partea de JWT, ca să poată rula și în middleware-ul Next (edge).

import { SignJWT, jwtVerify } from "jose";

export type Role = "owner" | "manager" | "reception" | "housekeeping" | "maintenance";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Proprietar",
  manager: "Manager",
  reception: "Recepție",
  housekeeping: "Curățenie",
  maintenance: "Întreținere",
};

/** Ce secțiuni vede fiecare rol în admin. */
export const ROLE_ACCESS: Record<Role, string[]> = {
  owner: ["*"],
  manager: ["*"],
  reception: ["/", "/rezervari", "/calendar", "/oaspeti", "/camere", "/curatenie", "/consumabile", "/mesaje", "/oferte", "/canale", "/facturi", "/cont"],
  housekeeping: ["/curatenie", "/camere", "/consumabile", "/cont"],
  maintenance: ["/curatenie", "/camere", "/cont"],
};

export function canAccess(role: Role, path: string) {
  const allowed = ROLE_ACCESS[role] ?? [];
  if (allowed.includes("*")) return true;
  return allowed.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
}

export type Session = { uid: string; name: string; role: Role };

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET lipsește sau e prea scurt (minim 32 caractere).");
    return new TextEncoder().encode("adonis-dev-secret-change-me-in-production-0000");
  }
  return new TextEncoder().encode(s);
};

export const SESSION_COOKIE = "adonis_session";
export const SESSION_TTL_H = 12;

export async function signSession(s: Session, ttlHours = SESSION_TTL_H) {
  return new SignJWT({ name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.uid)
    .setIssuedAt()
    .setIssuer("adonis-host")
    .setExpirationTime(`${ttlHours}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "adonis-host" });
    return { uid: String(payload.sub), name: String(payload.name), role: payload.role as Role };
  } catch {
    return null;
  }
}

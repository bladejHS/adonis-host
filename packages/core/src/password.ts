import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Parole scrypt — doar Node (nu se importă în middleware-ul edge).

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((res, rej) => scrypt(password, salt, 64, (e, k) => (e ? rej(e) : res(k))));
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await new Promise<Buffer>((res, rej) => scrypt(password, Buffer.from(saltB64, "base64"), expected.length, (e, k) => (e ? rej(e) : res(k))));
  return timingSafeEqual(key, expected);
}

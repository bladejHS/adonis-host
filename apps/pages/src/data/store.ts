// Baza de date a versiunii Pages: un singur obiect în memorie, salvat în IndexedDB pe dispozitiv.
// La prima deschidere se încarcă datele demo (demo-data.json), cu datele mutate astfel încât
// „azi” din demo să fie ziua de azi.

import { useSyncExternalStore } from "react";
import type { Db, Session } from "./types";

const DAY = 86_400_000;
const DB_NAME = "adonis-host";
const STORE = "kv";
const SCHEMA = 1;

// ── IndexedDB minimal (cheie → valoare; Date și Blob se păstrează nativ) ──

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key: string, value: unknown) {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Încărcarea datelor demo ──

const DATE_KEYS = new Set([
  "checkIn", "checkOut", "startDate", "endDate", "date", "validFrom", "birthDate", "paidAt", "issueDate", "dueDate", "takenAt", "signedAt",
  "lastSyncAt", "lastMessageAt", "completedAt", "startedAt", "finishedAt", "cancelledAt", "lastSyncedAt", "checkinDoneAt", "repliedAt",
  "createdAt", "updatedAt", "lastLoginAt",
]);

/** Transformă șirurile ISO în Date și mută toate datele cu `shiftDays`. */
function revive(value: unknown, shiftDays: number): unknown {
  if (Array.isArray(value)) return value.map((v) => revive(v, shiftDays));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = DATE_KEYS.has(k) && typeof v === "string" ? new Date(new Date(v).getTime() + shiftDays * DAY) : revive(v, shiftDays);
    }
    return out;
  }
  return value;
}

export async function loadDemoData(): Promise<Db> {
  const res = await fetch(`${import.meta.env.BASE_URL}demo-data.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error("Nu am putut încărca datele demo.");
  const raw = (await res.json()) as Record<string, unknown> & { exportedAt: string };
  const exported = new Date(raw.exportedAt);
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const shift = Math.round((today - Date.UTC(exported.getUTCFullYear(), exported.getUTCMonth(), exported.getUTCDate())) / DAY);
  const db = revive(raw, shift) as Db;
  return { ...db, version: SCHEMA, alerts: [], paymentLinks: [], checkins: [], consents: [] };
}

// ── Starea globală ──

let db: Db | null = null;
let tick = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export async function initStore() {
  const saved = await kvGet<Db>("db").catch(() => undefined);
  db = saved && saved.version === SCHEMA ? saved : await loadDemoData();
  if (!saved) await kvSet("db", db);
  tick++;
  listeners.forEach((l) => l());
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Baza de date nu e încărcată încă.");
  return db;
}

/** Aplică o modificare, re-randează și salvează pe dispozitiv (cu mică întârziere, grupat). */
export function mutate<T>(fn: (db: Db) => T): T {
  const result = fn(getDb());
  tick++;
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void kvSet("db", db), 150);
  return result;
}

export async function resetDemo() {
  db = await loadDemoData();
  await kvSet("db", db);
  tick++;
  listeners.forEach((l) => l());
}

export function replaceDb(next: Db) {
  db = next;
  void kvSet("db", db);
  tick++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Datele curente; componenta se re-randează la fiecare modificare. */
export function useDb(): Db {
  useSyncExternalStore(subscribe, () => tick);
  return getDb();
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 25) : Math.random().toString(36).slice(2) + Date.now().toString(36));

// ── Sesiunea (doar pe dispozitiv) ──

const SESSION_KEY = "adonis-session";
let session: Session | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
  } catch {
    return null;
  }
})();
const sessionListeners = new Set<() => void>();

export function setSession(s: Session | null) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* navigare privată */
  }
  sessionListeners.forEach((l) => l());
}

export function useSession() {
  return useSyncExternalStore(
    (l) => (sessionListeners.add(l), () => sessionListeners.delete(l)),
    () => session,
  );
}

export const asset = (p: string | null | undefined) => (p ? `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}` : "");

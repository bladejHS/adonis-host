// Capturi pentru ghidul personalului (docs/ghid/*.png). Necesită admin (:3000) și oaspeți (:3001) pornite.
// Rulare: npx tsx scripts/screenshots.mts
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const out = (n: string) => path.resolve("docs/ghid", n);
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.resolve("packages/database/prisma/dev.db").replace(/\\/g, "/")}` } } });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "ro-RO" });
await page.goto("http://localhost:3000/login");
await page.screenshot({ path: out("01-autentificare.png") });
await page.getByLabel("E-mail").fill("proprietar@casaadonis.ro");
await page.getByLabel("Parolă").fill("adonis-demo");
await page.getByRole("button", { name: "Intră în Adonis Host" }).click();
await page.waitForURL("http://localhost:3000/");

const withCheckin = await prisma.checkinRecord.findFirst({ orderBy: { signedAt: "desc" } });
const pages: [string, string][] = [
  ["02-panou.png", "/"],
  ["03-rezervari.png", "/rezervari"],
  ["04-rezervare-noua.png", "/rezervari/noua"],
  ["05-fisa-rezervare.png", withCheckin ? `/rezervari/${withCheckin.reservationId}` : "/rezervari"],
  ["06-calendar.png", "/calendar"],
  ["07-camere.png", "/camere"],
  ["08-curatenie.png", "/curatenie"],
  ["09-consumabile.png", "/consumabile"],
  ["10-mesaje.png", "/mesaje"],
  ["11-oferte.png", "/oferte"],
  ["12-canale.png", "/canale"],
  ["13-tarife.png", "/tarife"],
  ["14-facturi.png", "/facturi"],
  ["15-rapoarte.png", "/rapoarte?an=2026"],
  ["16-analitice.png", "/analitice?an=2026"],
  ["17-setari.png", "/setari"],
];
for (const [file, url] of pages) {
  await page.goto("http://localhost:3000" + url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800); // graficele se desenează după hidratare
  await page.screenshot({ path: out(file), fullPage: file !== "06-calendar.png" });
  console.log("✓", file);
}

// Aplicația pentru oaspeți, pe telefon
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ro-RO", isMobile: true, hasTouch: true });
const r = await prisma.reservation.findFirstOrThrow({ where: { status: "confirmed", checkIn: { gt: new Date(Date.now() + 2 * 86_400_000) }, checkinDoneAt: null }, orderBy: { checkIn: "asc" } });
for (const [file, url] of [
  ["20-oaspete-checkin.png", `/checkin/${r.checkinToken}`],
  ["21-oaspete-bun-venit.png", `/bun-venit/${r.checkinToken}`],
  ["22-oaspete-oferte.png", `/oferte/${r.checkinToken}`],
] as const) {
  await phone.goto("http://localhost:3001" + url);
  await phone.waitForLoadState("networkidle");
  await phone.screenshot({ path: out(file), fullPage: true });
  console.log("✓", file);
}
await browser.close();
await prisma.$disconnect();

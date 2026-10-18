// Exportă baza demo (packages/database/prisma/dev.db) în public/demo-data.json.
// Aplicația Pages o încarcă la prima deschidere și apoi lucrează doar în browser.
// Rulare: pnpm --filter @adonis/pages data   (după pnpm db:setup)

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(here, "../../../packages/database/prisma/dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? `file:${dbFile}` } } });

const data = {
  exportedAt: new Date().toISOString(),
  property: await prisma.property.findFirstOrThrow(),
  roomTypes: await prisma.roomType.findMany({ orderBy: { sortOrder: "asc" } }),
  rooms: await prisma.room.findMany({ orderBy: { number: "asc" } }),
  seasons: await prisma.seasonRule.findMany(),
  channels: await prisma.channel.findMany(),
  channelLinks: await prisma.channelRoomLink.findMany(),
  syncLogs: await prisma.channelSyncLog.findMany(),
  guests: await prisma.guest.findMany(),
  reservations: await prisma.reservation.findMany(),
  payments: await prisma.payment.findMany(),
  invoices: await prisma.invoice.findMany(),
  tasks: await prisma.housekeepingTask.findMany(),
  overrides: await prisma.availabilityOverride.findMany(),
  inventory: await prisma.inventoryItem.findMany(),
  movements: await prisma.inventoryMovement.findMany(),
  offers: await prisma.upsellOffer.findMany({ orderBy: { sortOrder: "asc" } }),
  purchases: await prisma.upsellPurchase.findMany(),
  upsellEvents: await prisma.upsellEvent.findMany({ select: { offerId: true, kind: true } }),
  templates: await prisma.messageTemplate.findMany(),
  reviews: await prisma.review.findMany(),
  media: await prisma.mediaAsset.findMany({ orderBy: { sortOrder: "asc" } }),
  users: (await prisma.user.findMany()).map(({ passwordHash: _, ...u }) => u),
  // datele check-in-urilor online (acte, semnături) nu se exportă: sunt personale
};

const out = path.resolve(here, "../public/demo-data.json");
writeFileSync(out, JSON.stringify(data));
console.log(`demo-data.json: ${data.reservations.length} rezervări, ${data.guests.length} oaspeți → ${out}`);
await prisma.$disconnect();

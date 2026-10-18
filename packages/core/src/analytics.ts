// Analitice: sezonalitate, satisfacția oaspeților și alerte proactive.

import { prisma, DAY_MS } from "@adonis/database";
import { REVIEW_SOURCE, computeSatisfaction, computeWeeklySeasonality } from "./pure/analytics";

export { holidays, type Holiday } from "./pure/analytics";

/** Ocupare și venit pe săptămâni, pentru graficul de sezonalitate. */
export async function weeklySeasonality(year: number, fromMonth = 4, toMonth = 10) {
  const from = new Date(Date.UTC(year, fromMonth - 1, 1));
  const to = new Date(Date.UTC(year, toMonth, 1));
  const [rooms, res] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({ where: { checkIn: { lt: to }, checkOut: { gt: from } }, select: { checkIn: true, checkOut: true, totalAmount: true, status: true } }),
  ]);
  return computeWeeklySeasonality(rooms, res, year, fromMonth, toMonth);
}

export async function satisfaction(from?: Date) {
  return computeSatisfaction(await prisma.review.findMany({ where: from ? { createdAt: { gte: from } } : {} }));
}

/** Generează alerte noi (fără dubluri cu cele încă deschise). Rulează la sincronizare și zilnic. */
export async function refreshAlerts(now = new Date()) {
  const created: string[] = [];
  const raise = async (kind: string, severity: string, title: string, body: string, link?: string) => {
    const open = await prisma.alert.findFirst({ where: { kind, title, resolvedAt: null } });
    if (!open) {
      await prisma.alert.create({ data: { kind, severity, title, body, link } });
      created.push(title);
    }
  };

  // 1. Ritmul rezervărilor: ultimele 14 zile față de aceeași perioadă de anul trecut
  const d14 = new Date(now.getTime() - 14 * DAY_MS);
  const recent = await prisma.reservation.count({ where: { createdAt: { gte: d14, lt: now } } });
  const lastYear = await prisma.reservation.count({ where: { createdAt: { gte: new Date(d14.getTime() - 365 * DAY_MS), lt: new Date(now.getTime() - 365 * DAY_MS) } } });
  // doar față de anul trecut: în extrasezon o scădere față de săptămânile anterioare e normală
  if (lastYear >= 5 && recent < lastYear * 0.7) {
    const drop = Math.round((1 - recent / lastYear) * 100);
    await raise("booking_pace_drop", "warning", `Rezervările au scăzut cu ${drop}% față de anul trecut`, `${recent} rezervări noi în ultimele 14 zile, față de ${lastYear} în aceeași perioadă de anul trecut. Merită o ofertă early booking sau o verificare a tarifelor pe Booking.`, "/rapoarte");
  }

  // 2. Recenzii negative fără răspuns
  const bad = await prisma.review.findMany({ where: { rating: { lt: 6 }, repliedAt: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } });
  for (const r of bad) {
    const src = REVIEW_SOURCE[r.source] ?? r.source;
    await raise("negative_review", "critical", `Recenzie ${r.rating.toFixed(1)}/10 pe ${src} de la ${r.author ?? "un oaspete"}`, (r.comment ?? r.title ?? "").slice(0, 280), "/analitice");
  }

  // 3. Consumabile sub stocul minim
  const items = await prisma.inventoryItem.findMany();
  for (const it of items.filter((i) => i.stock <= i.minStock)) {
    await raise("low_stock", "warning", `Stoc mic: ${it.name}`, `Au rămas ${it.stock} ${it.unit} (minim ${it.minStock}).`, "/consumabile");
  }

  // 4. Canal cu două sincronizări eșuate la rând
  const channels = await prisma.channel.findMany({ where: { syncType: { not: "none" }, active: true } });
  for (const c of channels) {
    const logs = await prisma.channelSyncLog.findMany({ where: { channelId: c.id }, orderBy: { startedAt: "desc" }, take: 2 });
    if (logs.length === 2 && logs.every((l) => l.status === "error")) {
      await raise("sync_error", "critical", `${c.name} nu se mai sincronizează`, logs[0].message ?? "Ultimele două sincronizări au eșuat.", "/canale");
    }
  }
  return created;
}

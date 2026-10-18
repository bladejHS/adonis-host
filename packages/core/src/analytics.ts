// Analitice: sezonalitate, satisfacția oaspeților și alerte proactive.

import { prisma, DAY_MS } from "@adonis/database";

export type Holiday = { date: string; name: string };

/** Momentele care umplu Costineștiul (date fixe + sărbători mobile pe anii folosiți). */
export function holidays(year: number): Holiday[] {
  const easter: Record<number, string> = { 2025: "04-20", 2026: "04-12", 2027: "05-02", 2028: "04-16" };
  const pentecost: Record<number, string> = { 2025: "06-08", 2026: "05-31", 2027: "06-20", 2028: "06-04" };
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: "Anul Nou" },
    { date: `${year}-05-01`, name: "1 Mai" },
    { date: `${year}-06-01`, name: "Ziua Copilului" },
    { date: `${year}-08-15`, name: "Sfânta Maria" },
    { date: `${year}-12-31`, name: "Revelion" },
  ];
  if (easter[year]) list.push({ date: `${year}-${easter[year]}`, name: "Paște" });
  if (pentecost[year]) list.push({ date: `${year}-${pentecost[year]}`, name: "Rusalii" });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Ocupare și venit pe săptămâni, pentru graficul de sezonalitate. */
export async function weeklySeasonality(year: number, fromMonth = 4, toMonth = 10) {
  const from = new Date(Date.UTC(year, fromMonth - 1, 1));
  const to = new Date(Date.UTC(year, toMonth, 1));
  const [rooms, res] = await Promise.all([
    prisma.room.count({ where: { active: true } }),
    prisma.reservation.findMany({
      where: { status: { in: ["confirmed", "checked_in", "checked_out", "pending"] }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { checkIn: true, checkOut: true, totalAmount: true },
    }),
  ]);
  const weeks: { start: Date; occupancy: number; revenue: number }[] = [];
  for (let t = from.getTime(); t < to.getTime(); t += 7 * DAY_MS) {
    let nights = 0;
    let revenue = 0;
    for (let d = t; d < Math.min(t + 7 * DAY_MS, to.getTime()); d += DAY_MS) {
      for (const r of res) {
        if (r.checkIn.getTime() <= d && r.checkOut.getTime() > d) {
          nights++;
          revenue += r.totalAmount / Math.max(1, Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS));
        }
      }
    }
    weeks.push({ start: new Date(t), occupancy: rooms ? nights / (rooms * 7) : 0, revenue });
  }
  return weeks;
}

export async function satisfaction(from?: Date) {
  const reviews = await prisma.review.findMany({ where: from ? { createdAt: { gte: from } } : {}, orderBy: { createdAt: "desc" } });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const bySource: Record<string, { count: number; avg: number }> = {};
  for (const src of Array.from(new Set(reviews.map((r) => r.source)))) {
    const xs = reviews.filter((r) => r.source === src).map((r) => r.rating);
    bySource[src] = { count: xs.length, avg: avg(xs) };
  }
  const buckets = [
    { label: "Excepțional (9–10)", min: 9, count: 0 },
    { label: "Foarte bine (8–9)", min: 8, count: 0 },
    { label: "Bine (6–8)", min: 6, count: 0 },
    { label: "Slab (sub 6)", min: 0, count: 0 },
  ];
  for (const r of reviews) buckets.find((b) => r.rating >= b.min)!.count++;
  // teme recurente din comentarii, pe cuvinte-cheie simple
  const themes: Record<string, string[]> = {
    "Vederea la mare": ["mare", "răsărit", "rasarit", "priveliște", "vedere"],
    Curățenia: ["curat", "curățenie", "curatenie"],
    Personalul: ["gazd", "personal", "amabil", "primitor"],
    Zgomotul: ["zgomot", "gălăgie", "galagie", "muzică"],
    "Prețul": ["preț", "pret", "scump", "raport calitate"],
    Parcarea: ["parcare"],
  };
  const themeCounts = Object.entries(themes).map(([name, words]) => ({
    name,
    count: reviews.filter((r) => words.some((w) => `${r.title ?? ""} ${r.comment ?? ""}`.toLowerCase().includes(w))).length,
  }));
  return { count: reviews.length, average: avg(reviews.map((r) => r.rating)), bySource, buckets, themes: themeCounts.sort((a, b) => b.count - a.count), latest: reviews.slice(0, 8) };
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
    const src = { booking: "Booking.com", airbnb: "Airbnb", google: "Google", direct: "site" }[r.source] ?? r.source;
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

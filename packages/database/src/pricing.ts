// Calcul tarif sejur: tarif zilnic explicit > regulă de sezon (cea mai prioritară) > tarif de bază.

export type SeasonLike = {
  name: string;
  roomTypeId: string | null;
  startDate: Date;
  endDate: Date; // inclusiv
  multiplier: number;
  minStay: number;
  priority: number;
};

export type NightPrice = { date: Date; rate: number; season: string | null; minStay: number };

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function nightsBetween(checkIn: Date, checkOut: Date) {
  return Math.max(0, Math.round((startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime()) / DAY_MS));
}

export function seasonFor<S extends SeasonLike>(date: Date, roomTypeId: string, seasons: S[]): S | null {
  const t = startOfDay(date).getTime();
  return (
    seasons
      .filter(
        (s) =>
          (s.roomTypeId === null || s.roomTypeId === roomTypeId) &&
          startOfDay(s.startDate).getTime() <= t &&
          startOfDay(s.endDate).getTime() >= t,
      )
      .sort((a, b) => b.priority - a.priority || Number(b.roomTypeId !== null) - Number(a.roomTypeId !== null))[0] ?? null
  );
}

export function quoteStay(opts: {
  checkIn: Date;
  checkOut: Date;
  roomTypeId: string;
  baseRate: number;
  seasons: SeasonLike[];
  dailyRates?: { date: Date; rate: number }[];
}) {
  const nights: NightPrice[] = [];
  const n = nightsBetween(opts.checkIn, opts.checkOut);
  const daily = new Map((opts.dailyRates ?? []).map((r) => [startOfDay(r.date).getTime(), r.rate]));
  for (let i = 0; i < n; i++) {
    const date = new Date(startOfDay(opts.checkIn).getTime() + i * DAY_MS);
    const season = seasonFor(date, opts.roomTypeId, opts.seasons);
    const explicit = daily.get(date.getTime());
    const rate = explicit ?? Math.round(opts.baseRate * (season?.multiplier ?? 1));
    nights.push({ date, rate, season: season?.name ?? null, minStay: season?.minStay ?? 1 });
  }
  const total = nights.reduce((s, x) => s + x.rate, 0);
  const minStay = nights.length ? Math.max(...nights.map((x) => x.minStay)) : 1;
  return { nights, total, minStay, minStayOk: n >= minStay };
}

export function touristTax(opts: {
  mode: string;
  value: number;
  accommodation: number;
  nights: number;
  adults: number;
}) {
  if (opts.mode === "per_night_person") return round2(opts.value * opts.nights * opts.adults);
  return round2((opts.accommodation * opts.value) / 100);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

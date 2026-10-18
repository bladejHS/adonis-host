const dLong = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const money = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export const fmtDay = (d: Date) => dLong.format(d);
export const lei = (n: number) => `${money.format(n)} lei`;

/** Ora aproximativă a răsăritului la Costinești (lat. 43.95°N), pentru mesajul de bun venit. */
export function sunriseCostinesti(date: Date) {
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000);
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const lat = (43.95 * Math.PI) / 180;
  const ha = Math.acos(-Math.tan(lat) * Math.tan((decl * Math.PI) / 180) - 0.0145 / (Math.cos(lat) * Math.cos((decl * Math.PI) / 180)));
  const solarNoonUtc = 12 - 28.65 / 15; // longitudine 28.65°E
  const b = ((2 * Math.PI) / 365) * (dayOfYear - 81);
  const eot = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
  const utcHours = solarNoonUtc - (ha * 180) / Math.PI / 15 - eot;
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + utcHours * 3600_000);
  return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(t);
}

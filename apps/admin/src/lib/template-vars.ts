// Variabile disponibile în șabloanele de mesaje. Pur — folosit și pe server, și în editor.

export const TEMPLATE_VARS = [
  { key: "guest_name", label: "Prenume oaspete", sample: "Maria" },
  { key: "guest_full_name", label: "Nume complet", sample: "Maria Popescu" },
  { key: "reservation_code", label: "Cod rezervare", sample: "ADN-2027-0412" },
  { key: "check_in_date", label: "Data sosirii", sample: "12 iulie" },
  { key: "check_out_date", label: "Data plecării", sample: "17 iulie" },
  { key: "check_in_time", label: "Ora check-in", sample: "15:00" },
  { key: "check_out_time", label: "Ora check-out", sample: "11:00" },
  { key: "room_number", label: "Camera", sample: "21" },
  { key: "room_type", label: "Tip cameră", sample: "Dublă cu vedere totală la mare" },
  { key: "nights", label: "Nopți", sample: "5" },
  { key: "total", label: "Total de plată", sample: "2.150 lei" },
  { key: "balance", label: "Rest de plată", sample: "1.505 lei" },
  { key: "wifi_name", label: "Rețea Wi-Fi", sample: "Adonis-Guest" },
  { key: "wifi_password", label: "Parolă Wi-Fi", sample: "rasarit2026" },
  { key: "checkin_link", label: "Link check-in online", sample: "https://adonis.ro/c/7HkQ" },
  { key: "next_year", label: "Anul viitor", sample: "2027" },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARS)[number]["key"], string>>;

export const SAMPLE_VARS: TemplateVars = Object.fromEntries(TEMPLATE_VARS.map((v) => [v.key, v.sample]));

export function renderTemplate(body: string, vars: TemplateVars) {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (vars as Record<string, string>)[k] ?? m);
}

/** Variabile folosite în text care nu există în listă — semnalate în editor. */
export function unknownVars(body: string) {
  const known = new Set<string>(TEMPLATE_VARS.map((v) => v.key));
  return Array.from(new Set(Array.from(body.matchAll(/\{(\w+)\}/g), (m) => m[1]).filter((k) => !known.has(k))));
}

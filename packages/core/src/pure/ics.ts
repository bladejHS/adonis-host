// Parser iCal minimal, fără dependențe Node — pentru browser (versiunea GitHub Pages)
// și pentru teste rapide. Serverul folosește node-ical, care acoperă și cazurile exotice.

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string };

function unfold(text: string) {
  // RFC 5545: o linie care începe cu spațiu sau tab continuă linia anterioară
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function parseDate(value: string, params: string) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  // zilele întregi (VALUE=DATE) și orele se normalizează la ziua UTC
  void params;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function parseIcsText(text: string): IcsEvent[] {
  const out: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of unfold(text).split("\n")) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (cur.start && cur.end && cur.end > cur.start) {
        out.push({ uid: cur.uid ?? `${cur.start.toISOString()}-${cur.end.toISOString()}`, start: cur.start, end: cur.end, summary: cur.summary ?? "" });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [name, ...params] = line.slice(0, idx).split(";");
      const value = line.slice(idx + 1);
      if (name === "UID") cur.uid = value.trim();
      else if (name === "SUMMARY") cur.summary = value.replace(/\\,/g, ",").replace(/\\n/gi, " ").trim();
      else if (name === "DTSTART") cur.start = parseDate(value, params.join(";")) ?? undefined;
      else if (name === "DTEND") cur.end = parseDate(value, params.join(";")) ?? undefined;
    }
  }
  return out;
}

/** Calendar iCal pentru o cameră (aceeași formă ca exportul serverului). */
export function buildIcs(roomNumber: string, blocks: { uid: string; start: Date; end: Date; summary: string }[], now = new Date()) {
  const day = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hostel Adonis Costinesti//Adonis Host//RO", "CALSCALE:GREGORIAN", `X-WR-CALNAME:Adonis camera ${roomNumber}`];
  for (const b of blocks) lines.push("BEGIN:VEVENT", `UID:${b.uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(b.start)}`, `DTEND;VALUE=DATE:${day(b.end)}`, `SUMMARY:${b.summary}`, "END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

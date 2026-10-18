// Watermark pe pozele de daune: dată, oră și cameră, arse în imagine (nu doar în metadate).
// Folosește sharp, de aceea e un modul separat (@adonis/core/watermark), încărcat doar de API.

import sharp from "sharp";

export async function watermarkPhoto(input: Buffer, label: string, takenAt = new Date()) {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = Math.min(meta.width ?? 1600, 1600);
  const resized = await img.resize({ width, withoutEnlargement: true }).toBuffer();
  const { height = 1200 } = await sharp(resized).metadata();
  const stamp = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Bucharest" }).format(takenAt);
  const size = Math.round(width / 32);
  const pad = Math.round(size * 0.6);
  const text = `${label} · ${stamp}`.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - size * 2.2}" width="${width}" height="${size * 2.2}" fill="#081a25" fill-opacity="0.72"/>
      <text x="${pad}" y="${height - size * 0.75}" font-family="Arial, sans-serif" font-size="${size}" fill="#e6cf98">${text}</text>
    </svg>`,
  );
  return sharp(resized).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
}

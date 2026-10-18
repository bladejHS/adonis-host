#!/usr/bin/env node
// Verificare de consistență a brandului (rulează în CI).
// 1. Orice culoare hex din cod trebuie să existe în packages/design-tokens/tokens.json.
// 2. Nicio culoare din familiile interzise: violet, indigo, mov, teal, albastru electric.
// 3. Nicio clasă Tailwind din paletele implicite (blue-500, purple-…, teal-…), doar token-urile Adonis.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(path.join(root, "packages/design-tokens/tokens.json"), "utf8");
const allowed = new Set([...tokens.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
// Neutre universale și culori din materiale reale (fotografii, logo) folosite doar decorativ
["#ffffff", "#000000", "#fad310", "#e8731a", "#efe7da", "#e2d6c2", "#ef9a90", "#1d3a4c", "#2b2410", "#1c2a06", "#3a1310", "#3a1d0e", "#f5e7e0", "#dca07a"].forEach((c) => allowed.add(c));

const SCAN = ["apps/admin/src", "apps/guest/src", "apps/staff-mobile/src", "packages/core/src", "packages/design-tokens/logo"];
const EXT = /\.(tsx?|css|svg|mjs)$/;
const BANNED_TW = /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|shadow)-(?:blue|indigo|violet|purple|fuchsia|teal|cyan|sky)-\d{2,3}\b/g;

function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function bannedHue(hex) {
  const { h, s, l } = hsl(hex);
  if (s < 0.35 || l < 0.12 || l > 0.9) return null; // neutre, foarte închise (bleumarinul brandului) sau foarte deschise
  if (h >= 245 && h <= 320) return "violet/indigo/mov";
  if (h >= 160 && h < 195) return "teal";
  if (h >= 195 && h < 245 && s > 0.6 && l > 0.3) return "albastru electric";
  return null;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXT.test(name) && !name.includes(".stories.")) yield full;
  }
}

const problems = [];
for (const rel of SCAN) {
  const dir = path.join(root, rel);
  try {
    statSync(dir);
  } catch {
    continue;
  }
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hex = m[0].toLowerCase();
        const why = bannedHue(hex);
        if (why) problems.push(`${path.relative(root, file)}:${i + 1}  ${hex} — culoare interzisă (${why})`);
        else if (!allowed.has(hex)) problems.push(`${path.relative(root, file)}:${i + 1}  ${hex} — nu există în tokens.json`);
      }
      for (const m of line.matchAll(BANNED_TW)) problems.push(`${path.relative(root, file)}:${i + 1}  ${m[0]} — paletă Tailwind implicită; folosiți navy/gold/ivory`);
    });
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} abateri de la identitatea Adonis:\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`✓ Culorile respectă design system-ul Adonis Riviera (${allowed.size} culori permise).`);

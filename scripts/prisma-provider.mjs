#!/usr/bin/env node
// Comută provider-ul Prisma: SQLite pentru dezvoltare locală, PostgreSQL pentru producție.
// Schema e scrisă portabil (fără enum-uri native, JSON stocat ca text), deci doar linia provider se schimbă.
// Folosire: node scripts/prisma-provider.mjs postgresql | sqlite

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (!["postgresql", "sqlite"].includes(target)) {
  console.error("Folosire: node scripts/prisma-provider.mjs postgresql|sqlite");
  process.exit(1);
}
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages/database/prisma/schema.prisma");
const schema = readFileSync(file, "utf8");
const next = schema.replace(/(datasource db \{\s*provider\s*=\s*)"(sqlite|postgresql)"/, `$1"${target}"`);
writeFileSync(file, next);
console.log(`Prisma provider: ${target}`);

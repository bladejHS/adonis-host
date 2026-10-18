// Exportă specificația OpenAPI în docs/openapi.json (fără să pornească serverul HTTP).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SwaggerModule } from "@nestjs/swagger";
import { createApp, openApiConfig } from "../src/main";

const app = await createApp();
const doc = SwaggerModule.createDocument(app, openApiConfig());
const out = path.resolve(import.meta.dirname, "../../../docs/openapi.json");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`OpenAPI: ${Object.keys(doc.paths).length} rute → ${out}`);
await app.close();

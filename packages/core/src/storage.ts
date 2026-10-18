// Stocare fișiere (acte de identitate, semnături, poze curățenie, facturi).
// Local: STORAGE_DIR (implicit ./storage). Producție: Cloudflare R2 prin API-ul compatibil S3.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredFile = { key: string; contentType: string };

const useR2 = () => Boolean(process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

function localRoot() {
  return path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));
}

async function r2() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "application/xml": "xml", "text/csv": "csv" };

/** Salvează un fișier și întoarce cheia (calea relativă). Cheile nu se ghicesc: conțin un UUID. */
export async function saveFile(folder: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFile> {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "");
  const key = `${safeFolder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[contentType] ?? "bin"}`;
  if (useR2()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await r2()).send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: data, ContentType: contentType }));
  } else {
    const full = path.join(localRoot(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }
  return { key, contentType };
}

export async function readStoredFile(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (key.includes("..")) return null;
  const ext = key.split(".").pop() ?? "";
  const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  try {
    if (useR2()) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const out = await (await r2()).send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
      return { data: Buffer.from(await out.Body!.transformToByteArray()), contentType };
    }
    return { data: await readFile(path.join(localRoot(), key)), contentType };
  } catch {
    return null;
  }
}

/** Decodează un data URL (semnătura din canvas, poza actului) cu limită de mărime. */
export function decodeDataUrl(dataUrl: string, maxBytes = 8 * 1024 * 1024) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("Fișierul trebuie să fie o imagine PNG, JPEG sau WebP.");
  const data = Buffer.from(m[2], "base64");
  if (data.length > maxBytes) throw new Error(`Imaginea e prea mare (maxim ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  return { data, contentType: m[1] };
}

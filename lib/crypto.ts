import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isDemo } from "@/lib/env";

// AES-256-GCM for Plaid and QuickBooks tokens at rest.
// TOKEN_ENCRYPTION_KEY: any long random string (e.g. `openssl rand -base64 32`).

function key(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    if (isDemo) return createHash("sha256").update("payvio-demo-only-key").digest();
    throw new Error("TOKEN_ENCRYPTION_KEY is not set. See docs/SETUP.md.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptJson<T>(payload: string): T {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

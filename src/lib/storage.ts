import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function isEphemeralRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function dataRoot() {
  return isEphemeralRuntime()
    ? path.join(os.tmpdir(), "hackerai")
    : path.join(process.cwd(), "data");
}

export function writableDir(...segments: string[]) {
  const dir = path.join(dataRoot(), ...segments);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    const fallback = path.join(os.tmpdir(), "hackerai", ...segments);
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
  return dir;
}

export function writableFile(...segments: string[]) {
  const file = path.join(dataRoot(), ...segments);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return file;
  } catch {
    const fallback = path.join(os.tmpdir(), "hackerai", ...segments);
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    return fallback;
  }
}

export function r2BaseUrl(config: { accountId: string; bucketName: string }) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}`;
}

export async function r2Upload(
  config: { accountId: string; bucketName: string; accessKeyId: string; secretAccessKey: string },
  key: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const base = r2BaseUrl(config);
  const url = `${base}/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-acl": "public-read",
    },
    body: data instanceof Buffer ? data : Buffer.from(data),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed HTTP ${response.status}: ${text}`);
  }
  return url;
}

export async function r2Download(
  config: { accountId: string; bucketName: string },
  key: string
): Promise<{ data: Buffer; contentType: string }> {
  const base = r2BaseUrl(config);
  const url = `${base}/${encodeURIComponent(key)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`R2 download failed HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  return { data: Buffer.from(arrayBuffer), contentType };
}

export function r2PublicUrl(
  config: { accountId: string; bucketName: string; publicUrl?: string },
  key: string
): string {
  const base = config.publicUrl ?? r2BaseUrl(config);
  return `${base}/${encodeURIComponent(key)}`;
}

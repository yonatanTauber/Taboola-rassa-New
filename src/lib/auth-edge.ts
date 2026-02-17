import { getAuthSecret } from "@/lib/auth-shared";

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function verifySessionTokenEdge(token: string | undefined) {
  if (!token) return null;
  const secret = getAuthSecret();
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const expected = bytesToBase64Url(new Uint8Array(signed));
  if (expected !== signature) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as { uid?: string; exp?: number };
  if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
  return { userId: payload.uid };
}

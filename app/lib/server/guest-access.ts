import { createHash, randomBytes } from "node:crypto";

export function createGuestAccessToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashGuestAccessToken(token) };
}

export function hashGuestAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

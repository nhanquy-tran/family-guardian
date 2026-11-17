import { createHash } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

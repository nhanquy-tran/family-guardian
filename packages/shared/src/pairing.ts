import { z } from "zod";
import { BROWSER_NAMES } from "./extension";

export const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 3_600_000;

// Only the code, browser name and OS name are sent (ADR 0005).
export const PairRequest = z.object({
  code: z.string().max(32),
  browser: z.enum(BROWSER_NAMES),
  os: z.string().min(1).max(32),
});
export type PairRequest = z.infer<typeof PairRequest>;

export const PairResponse = z.object({ deviceToken: z.string() });
export type PairResponse = z.infer<typeof PairResponse>;

export function generatePairingCode(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) code += PAIRING_ALPHABET[(bytes[i] ?? 0) % PAIRING_ALPHABET.length];
  return code;
}

export function normalizePairingCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
}

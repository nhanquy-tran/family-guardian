import { z } from "zod";

export const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 3_600_000;

export const PairRequest = z.object({});
export const PairResponse = z.object({});

export function generatePairingCode(randomBytes?: (n: number) => Uint8Array): string {
  void randomBytes;
  throw new Error("not implemented");
}

export function normalizePairingCode(input: string): string | null {
  void input;
  throw new Error("not implemented");
}

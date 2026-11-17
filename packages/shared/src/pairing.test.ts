import { describe, expect, it } from "vitest";
import { generatePairingCode, normalizePairingCode, PAIRING_ALPHABET, PairRequest } from "./pairing";

describe("pairing codes", () => {
  it("Alphabet has no ambiguous characters", () => {
    expect(PAIRING_ALPHABET).toHaveLength(32);
    expect(new Set(PAIRING_ALPHABET.split("")).size).toBe(32);
    expect(PAIRING_ALPHABET).toMatch(/^[A-Z0-9]+$/);
    for (const c of ["0", "O", "1", "I"]) expect(PAIRING_ALPHABET).not.toContain(c);
  });

  it("Deterministic mapping", () => {
    const stub = () => Uint8Array.from([0, 31, 32, 255, 8, 100]);
    expect(generatePairingCode(stub)).toBe("A9A9JE");
  });

  it("Default source gives valid codes", () => {
    for (let i = 0; i < 1000; i++) expect(generatePairingCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it("Normalisation", () => {
    expect(normalizePairingCode(" ab2-cd3 ")).toBe("AB2CD3");
    expect(normalizePairingCode("AB2CD")).toBeNull();
    expect(normalizePairingCode("AB2CD0")).toBeNull();
    expect(normalizePairingCode("AB2CDOO")).toBeNull();
  });
});

describe("pair contracts", () => {
  it("Valid request", () => {
    const parsed = PairRequest.parse({ code: "AB2CD3", browser: "edge", os: "Windows", url: "https://x.com/a" });
    expect(parsed).toEqual({ code: "AB2CD3", browser: "edge", os: "Windows" });
    expect(Object.keys(parsed)).not.toContain("url");
  });

  it("Invalid request", () => {
    expect(PairRequest.safeParse({ code: "AB2CD3", browser: "firefox", os: "Windows" }).success).toBe(false);
    expect(PairRequest.safeParse({ code: "AB2CD3", browser: "edge", os: "" }).success).toBe(false);
  });
});

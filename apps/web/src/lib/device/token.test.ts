import { describe, expect, it } from "vitest";
import { hashDeviceToken } from "./token";

describe("hashDeviceToken", () => {
  it("Token hash format", () => {
    expect(hashDeviceToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

import { describe, expect, it } from "vitest";
import { dependsOn, stateOf } from "./scheduler-rules.mjs";

describe("stateOf", () => {
  it("treats on-hold as the state even when ready or build-now is also set", () => {
    expect(stateOf(["bug", "ready", "on-hold", "autopilot"])).toBe("on-hold");
    expect(stateOf(["build-now", "on-hold"])).toBe("on-hold");
  });

  it("returns the first lifecycle label, or new", () => {
    expect(stateOf(["autopilot", "ready"])).toBe("ready");
    expect(stateOf(["autopilot", "in-review"])).toBe("in-review");
    expect(stateOf(["autopilot"])).toBe("new");
  });
});

describe("dependsOn", () => {
  it("adds the approved spec's Depends on to the issue body's", () => {
    expect(dependsOn("Depends on: none\n\nBody", "Depends on: #143\nTouches: x\n")).toEqual([143]);
    expect(dependsOn("Depends on: #12, #13", "Depends on: #13 #20")).toEqual([12, 13, 20]);
  });

  it("works without a proposal or a Depends on line", () => {
    expect(dependsOn("Depends on: #7", null)).toEqual([7]);
    expect(dependsOn("No line here", undefined)).toEqual([]);
    expect(dependsOn(null, "Depends on: none")).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createPairingCode, PAIRING_ERROR_MESSAGES } from "./create-code";

type Client = Parameters<typeof createPairingCode>[0];
type Result = { error: { code?: string; message?: string } | null };
type Call = { table: string; ops: [string, unknown[]][] };

const NOW = new Date("2026-11-17T10:00:00Z");
const EXPIRES = "2026-11-17T11:00:00.000Z";

/** Records every from() call; delete and insert resolve independently, inserts in sequence. */
function fakeClient(opts: { deleteResult?: Result; inserts?: Result[] }) {
  const calls: Call[] = [];
  let insertIndex = 0;
  const from = vi.fn((table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: Record<string, unknown> = {
      then: (resolve: (value: Result) => unknown) => {
        const first = call.ops[0]?.[0];
        if (first === "delete") return resolve(opts.deleteResult ?? { error: null });
        if (first === "insert") {
          const list = opts.inserts ?? [{ error: null }];
          return resolve(list[Math.min(insertIndex++, list.length - 1)]);
        }
        return resolve({ error: null });
      },
    };
    for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "order", "maybeSingle", "single"]) {
      chain[method] = (...args: unknown[]) => {
        call.ops.push([method, args]);
        return chain;
      };
    }
    return chain;
  });
  const ofKind = (kind: string) => calls.filter((c) => c.ops[0]?.[0] === kind);
  return { client: { from } as unknown as Client, calls, ofKind };
}

function generator(...codes: string[]) {
  let i = 0;
  return vi.fn(() => codes[Math.min(i++, codes.length - 1)]);
}

describe("createPairingCode", () => {
  it("Code created", async () => {
    const f = fakeClient({});
    const result = await createPairingCode(f.client, "child-1", { now: NOW, generate: generator("AB2CD3") });
    expect(result).toEqual({ ok: true, code: "AB2CD3", expiresAt: EXPIRES });
    expect(f.ofKind("insert")).toHaveLength(1);
    expect(f.ofKind("insert")[0]).toEqual({
      table: "pairing_codes",
      ops: [["insert", [{ code: "AB2CD3", child_id: "child-1", expires_at: EXPIRES }]]],
    });
  });

  it("Earlier codes are deleted before the insert", async () => {
    const f = fakeClient({});
    await createPairingCode(f.client, "child-1", { now: NOW, generate: generator("AB2CD3") });
    expect(f.calls[0]).toEqual({
      table: "pairing_codes",
      ops: [
        ["delete", []],
        ["eq", ["child_id", "child-1"]],
      ],
    });
    expect(f.calls.findIndex((c) => c.ops[0]?.[0] === "insert")).toBeGreaterThan(0);
    for (const call of f.calls.filter((c) => ["delete", "select"].includes(String(c.ops[0]?.[0])))) {
      expect(call.ops).toContainEqual(["eq", ["child_id", "child-1"]]);
    }
  });

  it("Failed delete of earlier codes does not insert", async () => {
    const f = fakeClient({ deleteResult: { error: { message: "nope" } } });
    const result = await createPairingCode(f.client, "child-1", { now: NOW, generate: generator("AB2CD3") });
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(f.ofKind("insert")).toHaveLength(0);
  });

  it("Retry after a collision", async () => {
    const f = fakeClient({ inserts: [{ error: { code: "23505" } }, { error: null }] });
    const generate = generator("AAAAAA", "BBBBBB");
    const result = await createPairingCode(f.client, "child-1", { now: NOW, generate });
    expect(result).toMatchObject({ ok: true, code: "BBBBBB" });
    expect(f.ofKind("insert")).toHaveLength(2);
    for (const kind of ["update", "upsert", "select"]) expect(f.ofKind(kind)).toHaveLength(0);
    expect(f.ofKind("delete")).toHaveLength(1);
  });

  it("Gives up after 3 retries", async () => {
    const f = fakeClient({ inserts: [{ error: { code: "23505" } }] });
    const generate = generator("AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE");
    const result = await createPairingCode(f.client, "child-1", { now: NOW, generate });
    expect(result).toEqual({ ok: false, reason: "in-use" });
    const inserted = f.ofKind("insert").map((c) => (c.ops[0][1][0] as { code: string }).code);
    expect(inserted).toEqual(["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"]);
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("Other errors are not retried", async () => {
    const f = fakeClient({ inserts: [{ error: { code: "42501" } }] });
    const result = await createPairingCode(f.client, "child-1", { now: NOW, generate: generator("AB2CD3") });
    expect(result).toEqual({ ok: false, reason: "failed" });
    expect(f.ofKind("insert")).toHaveLength(1);
  });

  it("Custom code in use", async () => {
    const f = fakeClient({ inserts: [{ error: { code: "23505" } }] });
    const result = await createPairingCode(f.client, "child-1", {
      now: NOW,
      generate: generator("AB2CD3"),
      customCode: "MYCODE",
    });
    expect(result).toEqual({ ok: false, reason: "custom-in-use" });
    expect(f.ofKind("insert")).toHaveLength(1);
    expect(f.ofKind("insert")[0].ops[0][1][0]).toMatchObject({ code: "MYCODE" });
    expect(PAIRING_ERROR_MESSAGES["custom-in-use"]).toBe("This code is already in use, please choose another");
  });
});

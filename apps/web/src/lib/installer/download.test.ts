import { describe, expect, it } from "vitest";
import { GET } from "../../app/install/[file]/route";
import { REG_FILES, regDownload, regFileResponse } from "./download";
import { buildRemoveReg, buildSetupReg } from "./reg";

function call(file: string): Promise<Response> {
  return GET(new Request(`http://localhost/install/${file}`), { params: Promise.resolve({ file }) });
}

describe("reg download", () => {
  it("Download response headers", async () => {
    const res = regDownload("FamilyGuardian-Setup.reg", "x");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="FamilyGuardian-Setup.reg"');
    expect(await res.text()).toBe("x");
  });

  it("Route serves the generated files", async () => {
    const setup = await call("FamilyGuardian-Setup.reg");
    expect(setup.status).toBe(200);
    expect(await setup.text()).toBe(buildSetupReg());
    expect(setup.headers.get("content-disposition")).toContain("FamilyGuardian-Setup.reg");

    const remove = await call("FamilyGuardian-Remove.reg");
    expect(remove.status).toBe(200);
    expect(await remove.text()).toBe(buildRemoveReg());
    expect(remove.headers.get("content-disposition")).toContain("FamilyGuardian-Remove.reg");
  });

  it("Unknown file name returns 404", async () => {
    for (const name of ["other.reg", "../package.json", "familyguardian-setup.reg"]) {
      const res = await call(name);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-disposition")).toBeNull();
      expect(await res.text()).not.toContain("Windows Registry Editor");
    }
  });

  it("Only known names are served", () => {
    expect(Object.keys(REG_FILES).sort()).toEqual(["FamilyGuardian-Remove.reg", "FamilyGuardian-Setup.reg"]);
    expect(regFileResponse("toString").status).toBe(404);
    expect(regFileResponse("__proto__").status).toBe(404);
  });
});

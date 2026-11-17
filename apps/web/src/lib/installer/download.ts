import { buildRemoveReg, buildSetupReg } from "./reg";

export const REG_FILES: Record<string, () => string> = {
  "FamilyGuardian-Setup.reg": buildSetupReg,
  "FamilyGuardian-Remove.reg": buildRemoveReg,
};

export function regDownload(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function regFileResponse(name: string): Response {
  if (!Object.hasOwn(REG_FILES, name)) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return regDownload(name, REG_FILES[name]());
}

export const REG_FILES: Record<string, () => string> = {};

export function regDownload(_filename: string, _body: string): Response {
  throw new Error("not implemented");
}

export function regFileResponse(_name: string): Response {
  throw new Error("not implemented");
}

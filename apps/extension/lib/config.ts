export function resolveApiBaseUrl(raw: string | undefined): string {
  const fail = (): never => {
    throw new Error("WXT_API_BASE_URL must be an https URL (or http://localhost for development)");
  };
  if (!raw) return fail();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail();
  }
  const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) return fail();
  return raw.replace(/\/+$/, "");
}

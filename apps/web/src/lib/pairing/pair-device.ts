export type PairDeps = {
  hashIp: (ip: string) => string;
  registerAttempt: (ipHash: string) => Promise<number> | number;
  redeem: (code: string, tokenHash: string, browser: string, os: string) => Promise<string | null> | string | null;
};
export type PairResult = { status: number; body: Record<string, unknown> };

export function hmacSha256Hex(secret: string, value: string): string {
  void secret;
  void value;
  throw new Error("not implemented");
}

export function clientIp(headers: Headers, warn: (message: string) => void): string {
  void headers;
  void warn;
  throw new Error("not implemented");
}

export async function pairDevice(deps: PairDeps, ip: string, body: unknown): Promise<PairResult> {
  void deps;
  void ip;
  void body;
  throw new Error("not implemented");
}

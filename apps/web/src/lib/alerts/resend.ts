import type { Mailer } from "./offline";

export type ResendOptions = { apiKey: string; from: string; fetch?: typeof fetch };

export function createResendMailer(_options: ResendOptions): Mailer {
  throw new Error("not implemented");
}

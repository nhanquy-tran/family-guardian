import type { Mailer } from "./offline";

export type ResendOptions = { apiKey: string; from: string; fetch?: typeof fetch };

export function createResendMailer(options: ResendOptions): Mailer {
  const doFetch = options.fetch ?? fetch;
  return {
    async send(message) {
      try {
        const res = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          }),
        });
        return { ok: res.ok };
      } catch {
        return { ok: false };
      }
    },
  };
}

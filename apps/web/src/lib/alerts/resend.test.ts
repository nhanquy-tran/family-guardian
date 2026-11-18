import { describe, expect, it, vi } from "vitest";
import { createResendMailer } from "./resend";

const message = { to: "a@x.test", subject: "Mia: laptop offline", text: "Mia's Edge on Windows has not reported." };

function mailer(fetchImpl: typeof fetch) {
  return createResendMailer({ apiKey: "re_key", from: "Guardian <alerts@x.test>", fetch: fetchImpl });
}

describe("createResendMailer", () => {
  it("Request shape", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("{}", { status: 200 }));
    const res = await mailer(fetchMock as unknown as typeof fetch).send(message);

    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer re_key");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.to).toEqual(["a@x.test"]);
    expect(body.subject).toBe("Mia: laptop offline");
    expect(body.from).toBe("Guardian <alerts@x.test>");
    expect(typeof body.text).toBe("string");
    expect(body).not.toHaveProperty("html");
  });

  it("Mailer body with html", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("{}", { status: 200 }));
    const m = mailer(fetchMock as unknown as typeof fetch);
    const withHtml = { ...message, html: "<html lang=\"en\"><body><h1>Report</h1></body></html>" };
    await m.send(message);
    await m.send(withHtml);

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body)) as Record<string, unknown>);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).not.toHaveProperty("html");
    expect(bodies[1]?.text).toBe(message.text);
    expect(bodies[1]?.html).toBe(withHtml.html);
  });

  it("Failure is contained", async () => {
    const status429 = vi.fn(async () => new Response("{}", { status: 429 }));
    expect(await mailer(status429 as unknown as typeof fetch).send(message)).toEqual({ ok: false });

    const throwing = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await mailer(throwing as unknown as typeof fetch).send(message)).toEqual({ ok: false });
  });
});

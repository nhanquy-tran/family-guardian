import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ acceptLanguage: null as string | null }));

vi.mock("next/headers", () => ({
  headers: async () => {
    const h = new Headers();
    if (mocks.acceptLanguage !== null) h.set("accept-language", mocks.acceptLanguage);
    return h;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  },
  usePathname: () => null,
}));

import { authRedirect } from "../lib/auth/redirects";
import { getMessages } from "../lib/i18n/messages";
import { config } from "../proxy";
import RootPage from "./page";
import { dynamicParams, generateStaticParams } from "./[locale]/page";
import { generateMetadata } from "./[locale]/layout";
import * as setupPage from "./[locale]/setup/page";
import * as faqPage from "./[locale]/faq/page";
import * as helpPage from "./[locale]/help/page";
import robots from "./robots";
import sitemap from "./sitemap";

const here = __dirname;
const ORIGIN = "https://family-guardian.co";
const text = (v: unknown) => (typeof v === "string" ? v : "");

beforeEach(() => {
  mocks.acceptLanguage = null;
});

describe("public site routing and SEO", () => {
  it("Root redirects by language", async () => {
    mocks.acceptLanguage = "vi";
    await expect(Promise.resolve().then(() => RootPage())).rejects.toThrow("REDIRECT:/vi");
    mocks.acceptLanguage = null;
    await expect(Promise.resolve().then(() => RootPage())).rejects.toThrow("REDIRECT:/en");
  });

  it("Unknown locale is 404", async () => {
    expect(dynamicParams).toBe(false);
    const params = await generateStaticParams();
    expect(params.map((p) => p.locale).sort()).toEqual(["en", "vi", "zh"]);
  });

  it("Auth and app routes are untouched", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/login"]);
    const proxySrc = readFileSync(resolve(here, "../proxy.ts"), "utf8");
    expect(proxySrc).not.toContain("locale");
    expect(proxySrc).not.toContain("Accept-Language");
    expect(authRedirect("/en", false)).toBeNull();
    expect(authRedirect("/vi", true)).toBeNull();
    for (const f of ["login", "dashboard", "install", "privacy"]) {
      expect(existsSync(resolve(here, f, "page.tsx")), f).toBe(true);
    }
  });

  it("Metadata per locale", async () => {
    const titles = new Set<string>();
    for (const locale of ["en", "vi", "zh"]) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      const m = getMessages(locale as "en") as { meta: { title: string; description: string } };
      expect(meta.title).toBe(m.meta.title);
      expect(meta.description).toBe(m.meta.description);
      titles.add(text(meta.title));
    }
    expect(titles.size).toBe(3);

    const vi_ = await generateMetadata({ params: Promise.resolve({ locale: "vi" }) });
    expect(vi_.alternates?.canonical).toBe(`${ORIGIN}/vi`);
    expect(vi_.alternates?.languages).toEqual({
      en: `${ORIGIN}/en`,
      vi: `${ORIGIN}/vi`,
      zh: `${ORIGIN}/zh`,
      "x-default": `${ORIGIN}/en`,
    });
    expect(vi_.openGraph).toMatchObject({
      title: vi_.title,
      description: vi_.description,
      url: `${ORIGIN}/vi`,
      type: "website",
      siteName: "Family Guardian",
      locale: "vi_VN",
    });
  });

  it("Sitemap and robots", () => {
    const urls = sitemap().map((e) => e.url);
    const paths = ["en", "vi", "zh", "privacy"];
    for (const page of ["setup", "faq", "help"]) for (const l of ["en", "vi", "zh"]) paths.push(`${l}/${page}`);
    expect(urls).toHaveLength(13);
    expect([...urls].sort()).toEqual(paths.map((p) => `${ORIGIN}/${p}`).sort());
    for (const u of urls) expect(u).not.toMatch(/dashboard|login|install|api|auth/);

    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const allow = rules.flatMap((x) => (x.allow === undefined ? [] : [x.allow].flat()));
    const disallow = rules.flatMap((x) => (x.disallow === undefined ? [] : [x.disallow].flat()));
    expect(allow).toContain("/");
    for (const p of ["/dashboard", "/api", "/auth", "/login", "/install"]) expect(disallow, p).toContain(p);
    expect(r.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it("Routes and 404", async () => {
    for (const page of [setupPage, faqPage, helpPage]) {
      expect(page.dynamicParams).toBe(false);
      const params = await page.generateStaticParams();
      expect(params.map((p) => p.locale).sort()).toEqual(["en", "vi", "zh"]);
    }
    for (const d of ["setup", "faq", "help"]) {
      expect(readFileSync(resolve(here, "[locale]", d, "page.tsx"), "utf8"), d).not.toContain("<html");
    }
  });

  it("Metadata and hreflang", async () => {
    const meta = await faqPage.generateMetadata({ params: Promise.resolve({ locale: "vi" }) });
    const m = getMessages("vi") as unknown as { faq: { meta: { title: string; description: string } } };
    expect(meta.title).toBe(m.faq.meta.title);
    expect(meta.description).toBe(m.faq.meta.description);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/vi/faq`);
    expect(meta.alternates?.languages).toEqual({
      en: `${ORIGIN}/en/faq`,
      vi: `${ORIGIN}/vi/faq`,
      zh: `${ORIGIN}/zh/faq`,
      "x-default": `${ORIGIN}/en/faq`,
    });
    expect(meta.openGraph).toMatchObject({
      title: meta.title,
      description: meta.description,
      url: `${ORIGIN}/vi/faq`,
      siteName: "Family Guardian",
      type: "website",
      locale: "vi_VN",
    });
    for (const [page, mod] of [["setup", setupPage], ["help", helpPage]] as const) {
      const og = (await mod.generateMetadata({ params: Promise.resolve({ locale: "zh" }) })).openGraph;
      expect(og?.url, page).toBe(`${ORIGIN}/zh/${page}`);
      expect(og?.locale, page).toBe("zh_CN");
    }
  });

  it("Help and FAQ text matches the product", () => {
    for (const l of ["en", "vi", "zh"] as const) {
      const m = getMessages(l) as unknown as {
        help: { s5: { step2: string } };
        faq: { a5: string };
      };
      expect(m.help.s5.step2, l).not.toMatch(/alert|cảnh báo|提醒/i);
    }
    const en = getMessages("en") as unknown as { faq: { a5: string } };
    expect(en.faq.a5).toContain("share of time on your homework sites, minus a penalty for switching");
  });

  it("Same metadata rules for setup and help", async () => {
    const zh = () => ({ params: Promise.resolve({ locale: "zh" }) });
    const setup = await setupPage.generateMetadata(zh());
    const help = await helpPage.generateMetadata(zh());
    const faq = await faqPage.generateMetadata(zh());
    expect(setup.alternates?.canonical).toBe(`${ORIGIN}/zh/setup`);
    expect(help.alternates?.canonical).toBe(`${ORIGIN}/zh/help`);
    expect(new Set([text(setup.title), text(faq.title), text(help.title)]).size).toBe(3);
  });

  it("Page reads the env variable", () => {
    const page = readFileSync(resolve(here, "[locale]", "help", "page.tsx"), "utf8");
    expect(page).toContain("NEXT_PUBLIC_SUPPORT_EMAIL");
    const dir = resolve(here, "../components/site");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx") && !n.includes(".test."))) {
      expect(readFileSync(resolve(dir, f), "utf8"), f).not.toContain("NEXT_PUBLIC_SUPPORT_EMAIL");
    }
  });
});

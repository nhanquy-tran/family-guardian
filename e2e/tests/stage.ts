import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { test as base, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { generate, type Fixture, type Stage } from "../fixtures/scenario.ts";
import { seed } from "../fixtures/store.ts";
import { supabaseStore } from "../fixtures/supabase-store.ts";
import { localSupabase, type LocalSupabase } from "../local-supabase.ts";

type Cookie = { name: string; value: string; domain: string; path: string };

/**
 * Parents sign in with Google only, so tests mint a session through the local admin API (magic link + verify)
 * and hand the browser the same cookies @supabase/ssr would set.
 */
async function sessionCookies(env: LocalSupabase, email: string): Promise<Cookie[]> {
  const admin = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("no session");
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(env.url, env.anonKey, {
    cookies: { getAll: () => [], setAll: (list) => void jar.push(...list) },
  });
  const { access_token, refresh_token } = verified.data.session;
  const set = await ssr.auth.setSession({ access_token, refresh_token });
  if (set.error) throw set.error;
  return jar.map(({ name, value }) => ({ name, value, domain: "localhost", path: "/" }));
}

type StageFixtures = { fixture: Fixture; shot: (name: string) => Promise<void> };

/** Seeds `stage` once per file (teardown first, so every run starts clean) and signs every page in as its parent. */
export function stageTest(stage: Stage) {
  let fixture: Fixture;
  let cookies: Cookie[] = [];
  const test = base.extend<StageFixtures>({
    fixture: async ({}, use) => use(fixture),
    page: async ({ page }, use) => {
      await page.context().addCookies(cookies);
      await use(page);
    },
    shot: async ({ page }, use, info) => {
      await use(async (name) => screenshot(page, join(stage, info.project.name), name));
    },
  });
  test.beforeAll(async () => {
    const env = localSupabase();
    fixture = generate(stage);
    await seed(supabaseStore(env), fixture);
    cookies = await sessionCookies(env, fixture.parent.email);
  });
  return test;
}

export const SCREENSHOT_DIR = join(import.meta.dirname, "..", "screenshots");

export async function screenshot(page: Page, folder: string, name: string): Promise<void> {
  const dir = join(SCREENSHOT_DIR, folder);
  mkdirSync(dir, { recursive: true });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true, animations: "disabled" });
}

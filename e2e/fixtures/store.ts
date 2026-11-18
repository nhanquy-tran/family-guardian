import { E2E_EMAIL_DOMAIN, type Fixture } from "./scenario.ts";

export type Row = Record<string, unknown>;

/** The few writes seeding needs; implemented for PGlite (tests) and Supabase (local stack). Runs as service role. */
export interface Store {
  /** Creates the auth user; the on_auth_user_created trigger creates its family. */
  createParent(email: string, fullName: string): Promise<{ userId: string; familyId: string }>;
  /** Auth users whose email ends with @domain. */
  findUsers(emailDomain: string): Promise<string[]>;
  familiesOf(userIds: string[]): Promise<string[]>;
  updateFamily(familyId: string, patch: Row): Promise<void>;
  insert(table: string, rows: Row[]): Promise<void>;
  deleteFamilies(familyIds: string[]): Promise<void>;
  deleteUsers(userIds: string[]): Promise<void>;
}

/**
 * Removes everything the e2e seed owns: the reserved-domain auth users and their families. Deleting a family
 * cascades to parents, children, devices, usage, rules, events, limits, overrides and alerts.
 */
export async function teardown(store: Store): Promise<void> {
  const users = await store.findUsers(E2E_EMAIL_DOMAIN);
  if (users.length === 0) return;
  await store.deleteFamilies(await store.familiesOf(users));
  await store.deleteUsers(users);
}

export async function seed(store: Store, f: Fixture): Promise<{ userId: string; familyId: string }> {
  if (!f.parent.email.endsWith(`@${E2E_EMAIL_DOMAIN}`)) throw new Error("seed only writes reserved e2e accounts");
  await teardown(store);
  const { userId, familyId } = await store.createParent(f.parent.email, f.parent.fullName);
  await store.updateFamily(familyId, f.family);
  await store.insert("children", f.children.map((c) => ({ ...c, family_id: familyId })));
  await store.insert("devices", f.devices);
  await store.insert("domain_categories", f.categoryOverrides.map((o) => ({ ...o, family_id: familyId })));
  await store.insert("usage_minutes", f.usage);
  await store.insert("block_rules", f.blockRules);
  await store.insert("block_events", f.blockEvents);
  await store.insert("child_category_limits", f.categoryLimits);
  await store.insert("alerts", f.alerts);
  return { userId, familyId };
}

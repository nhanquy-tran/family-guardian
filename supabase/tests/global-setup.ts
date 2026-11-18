import { ensureSnapshot } from "./harness";

// Builds the migrated PGlite snapshot once, before workers start, so they do not each replay migrations.
export default async function setup(): Promise<void> {
  await ensureSnapshot();
}

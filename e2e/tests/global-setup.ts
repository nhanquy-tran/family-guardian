import { rmSync } from "node:fs";
import { SCREENSHOT_DIR } from "./stage.ts";

/** Starts every run with an empty screenshot folder so renamed or removed shots do not linger. */
export default function globalSetup(): void {
  rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
}

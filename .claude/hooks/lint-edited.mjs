// PostToolUse hook: auto-fix lint on the edited web file. Never blocks the agent.
import { execFileSync } from "node:child_process";

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const file = String(JSON.parse(input)?.tool_input?.file_path ?? "").replaceAll("\\", "/");
    const rel = file.split("/apps/web/")[1];
    if (rel && /\.(ts|tsx)$/.test(rel)) {
      execFileSync("npx", ["eslint", "--fix", rel], {
        cwd: "apps/web",
        stdio: "ignore",
        shell: process.platform === "win32",
      });
    }
  } catch {
    // Lint problems are reported by the gates, not here.
  }
});

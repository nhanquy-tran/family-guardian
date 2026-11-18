import Link from "next/link";
import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { card, container, pageTitle } from "../ui";

const textLink =
  "font-medium text-accent-ink underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";

const STEPS = ["signIn", "child", "code", "installer", "standard", "restart", "pair", "dashboard"] as const;

export function SetupGuide({ messages }: { locale: Locale; messages: Messages }) {
  const m = messages.setup;
  return (
    <main className={`${container} flex flex-col gap-4`}>
      <h1 className={`${pageTitle} !mb-0`}>{m.title}</h1>
      <p className="text-ink-2">{m.intro}</p>
      <ol className="flex flex-col gap-3">
        {STEPS.map((key, i) => (
          <li key={key} className={`${card} flex gap-3`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-accent text-sm font-semibold text-accent-contrast">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-ink">{m.steps[key]}</span>
              {key === "signIn" && (
                <Link href="/login" className={textLink}>
                  {m.loginLink}
                </Link>
              )}
              {key === "installer" && (
                <Link href="/install" className={textLink}>
                  {m.installLink}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

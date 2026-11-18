import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { buttonPrimary, buttonSecondary, card, cardTitle, container, pillAccent, pillGrey } from "../ui";

const textLink =
  "font-medium text-accent-ink underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";
const sectionTitle = "text-2xl font-semibold tracking-tight text-ink";

const STEPS = ["signIn", "child", "install", "dashboard"] as const;
const FEATURES = ["activity", "blocking", "score", "alerts", "privacy"] as const;
const COLLECTED = ["domain", "time"] as const;
const NEVER = ["urls", "content", "keystrokes", "screenshots"] as const;

export function Home({ messages }: { locale: Locale; messages: Messages }) {
  const m = messages;
  return (
    <main className={`${container} flex flex-col gap-10`}>
      <section className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={48} height={48} />
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{m.hero.title}</h1>
        </div>
        <p className="text-lg text-ink-2">{m.hero.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          <a href="/login" className={buttonPrimary}>
            {m.hero.signIn}
          </a>
          <a href="#how-it-works" className={buttonSecondary}>
            {m.hero.how}
          </a>
        </div>
      </section>

      <section id="how-it-works" className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{m.how.title}</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STEPS.map((key, i) => {
            const step = m.how.steps[key];
            return (
              <li key={key} className={`${card} flex gap-3`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-accent text-sm font-semibold text-accent-contrast">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className={cardTitle}>{step.title}</h3>
                  <p className="text-sm text-ink-2">{step.text}</p>
                  {"link" in step && (
                    <a href="/install" className={textLink}>
                      {step.link}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="features" className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{m.features.title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((key) => (
            <div key={key} className={card}>
              <h3 className={cardTitle}>{m.features[key].title}</h3>
              <p className="text-sm text-ink-2">{m.features[key].text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" className={`${card} flex flex-col gap-4`}>
        <h2 className={sectionTitle}>{m.privacy.title}</h2>
        <p className="text-ink-2">{m.privacy.intro}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className={cardTitle}>{m.privacy.collectedTitle}</h3>
            <ul className="flex flex-wrap gap-2">
              {COLLECTED.map((key) => (
                <li key={key} className={pillAccent}>
                  {m.privacy.collected[key]}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className={cardTitle}>{m.privacy.neverTitle}</h3>
            <ul className="flex flex-wrap gap-2">
              {NEVER.map((key) => (
                <li key={key} className={pillGrey}>
                  {m.privacy.never[key]}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <a href="/privacy" className={textLink}>
          {m.privacy.link}
        </a>
      </section>
    </main>
  );
}

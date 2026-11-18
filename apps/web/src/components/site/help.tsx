import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { card, cardTitle, container, pageTitle } from "../ui";

const textLink =
  "font-medium text-accent-ink underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";

const SECTIONS = ["s1", "s2", "s3", "s4", "s5"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Help({
  messages,
  supportEmail,
}: {
  locale: Locale;
  messages: Messages;
  supportEmail?: string;
}) {
  const m = messages.help;
  const email = supportEmail && EMAIL.test(supportEmail) ? supportEmail : null;
  return (
    <main className={`${container} flex flex-col gap-4`}>
      <h1 className={`${pageTitle} !mb-0`}>{m.title}</h1>
      <p className="text-ink-2">{m.intro}</p>
      {SECTIONS.map((key) => {
        const s = m[key];
        return (
          <section key={key} className={`${card} flex flex-col gap-2`}>
            <h2 className={`${cardTitle} !mb-0`}>{s.title}</h2>
            <p className="text-ink-2">{s.text}</p>
            <ol className="list-decimal pl-5 text-ink">
              <li>{s.step1}</li>
              <li>{s.step2}</li>
              <li>{s.step3}</li>
            </ol>
          </section>
        );
      })}
      {email && (
        <div id="contact" className={`${card} flex flex-col gap-2`}>
          <h2 className={`${cardTitle} !mb-0`}>{m.contactTitle}</h2>
          <p className="text-ink-2">{m.contactText}</p>
          <a href={`mailto:${email}`} className={textLink}>
            {email}
          </a>
        </div>
      )}
    </main>
  );
}

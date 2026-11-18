import Link from "next/link";
import type { Locale } from "../../lib/i18n/locale";
import type { Messages } from "../../lib/i18n/messages";
import { card, container, pageTitle } from "../ui";

const textLink =
  "font-medium text-accent-ink underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";
const summaryClass =
  "cursor-pointer font-medium text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft";

const DELETE_QUESTION = 8;

export function Faq({ messages }: { locale: Locale; messages: Messages }) {
  const m = messages.faq;
  const items = [
    [m.q1, m.a1],
    [m.q2, m.a2],
    [m.q3, m.a3],
    [m.q4, m.a4],
    [m.q5, m.a5],
    [m.q6, m.a6],
    [m.q7, m.a7],
    [m.q8, m.a8],
    [m.q9, m.a9],
    [m.q10, m.a10],
    [m.q11, m.a11],
  ];
  return (
    <main className={`${container} flex flex-col gap-4`}>
      <h1 className={`${pageTitle} !mb-0`}>{m.title}</h1>
      {items.map(([q, a], i) => {
        const n = i + 1;
        return (
        <details key={n} className={card}>
          <summary className={summaryClass}>{q}</summary>
          <p className="mt-3 text-ink-2">{a}</p>
          {n === DELETE_QUESTION && (
            <Link href="/privacy" className={textLink}>
              {m.privacyLink}
            </Link>
          )}
        </details>
        );
      })}
    </main>
  );
}

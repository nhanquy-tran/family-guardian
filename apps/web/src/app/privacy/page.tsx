import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy · Family Guardian",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 leading-relaxed">
      <h1 className="text-3xl font-semibold">Privacy policy</h1>
      <p className="text-sm text-neutral-500">Last updated: 17 November 2026</p>

      <p>
        Family Guardian helps parents see which websites their child uses on a computer, for how long, and to block
        sites they choose. It consists of a browser extension installed on the child&apos;s computer by a parent, and a
        web dashboard for parents.
      </p>

      <h2 className="text-xl font-semibold">What the extension collects</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>The website domain of the active tab (for example <code>youtube.com</code>), never the full address</li>
        <li>How many seconds per minute that domain was in use while the person was active</li>
        <li>Domains of sites that were blocked by a parent&apos;s rule, and when</li>
        <li>The browser and operating system name, and the extension version</li>
      </ul>

      <h2 className="text-xl font-semibold">What is never collected</h2>
      <p>
        Full web addresses, page titles, page content, search terms, messages, keystrokes, form data, passwords,
        screenshots, location, or browsing in other browsers.
      </p>

      <h2 className="text-xl font-semibold">Parents&apos; data</h2>
      <p>Parents sign in with Google. We store their name, e-mail address and the children and devices they add.</p>

      <h2 className="text-xl font-semibold">How data is used and shared</h2>
      <p>
        Data is used only to show reports, enforce blocking rules and send alerts to the parents of that family. It is
        not sold, not used for advertising and not shared with third parties, except the service providers that host
        it: Supabase (database), Vercel (web hosting) and Resend (e-mail). Data is sent over HTTPS.
      </p>

      <h2 className="text-xl font-semibold">Retention and deletion</h2>
      <p>
        Usage data is kept for 13 months and then deleted. A parent can delete a child, a device or the whole family
        account at any time, which deletes the related data.
      </p>

      <h2 className="text-xl font-semibold">Contact</h2>
      <p>
        Questions or deletion requests:{" "}
        <a className="underline" href="https://github.com/nhanquy-tran/family-guardian/issues">
          open an issue on the project page
        </a>
        .
      </p>
    </main>
  );
}

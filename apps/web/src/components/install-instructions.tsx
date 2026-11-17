import type { JSX } from "react";
import { alertWarning, card } from "./ui";

const code = "rounded-sm bg-shell px-1 font-mono text-sm";

export function InstallInstructions(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <section className={alertWarning}>
        <h2 className="text-lg font-semibold">Before you start: use a Standard account</h2>
        <p>
          Your child must use a <strong>Standard</strong> Windows account, not an <strong>Administrator</strong>{" "}
          account. An administrator can delete the policy. To check, open Settings → Accounts → Family / Other users,
          pick your child&apos;s account and choose Change account type.
        </p>
      </section>

      <ol className={`${card} flex list-decimal flex-col gap-4 pl-10 sm:pl-12`}>
        <li>
          On your child&apos;s laptop, sign in as an administrator (or have the administrator password ready), then
          download{" "}
          <a href="/install/FamilyGuardian-Setup.reg" download className="text-accent-ink underline">
            FamilyGuardian-Setup.reg
          </a>
          .
        </li>
        <li>Double-click the file, accept the User Account Control prompt and the Registry Editor warning.</li>
        <li>Fully close and reopen Chrome, Edge and Brave.</li>
        <li>
          Verify: open <span className={code}>chrome://policy</span>, <span className={code}>edge://policy</span> and{" "}
          <span className={code}>brave://policy</span> and click Reload policies. Check that{" "}
          <span className={code}>ExtensionInstallForcelist</span>, <span className={code}>IncognitoModeAvailability</span>{" "}
          (<span className={code}>InPrivateModeAvailability</span> in Edge) and{" "}
          <span className={code}>BrowserGuestModeEnabled</span> show status OK. Family Guardian should appear on the
          extensions page as installed by your organisation, and a private window and a guest window should not open.
        </li>
        <li>Then pair the extension with the code from the dashboard.</li>
        <li>
          To remove: download and run{" "}
          <a href="/install/FamilyGuardian-Remove.reg" download className="text-accent-ink underline">
            FamilyGuardian-Remove.reg
          </a>{" "}
          as administrator and restart the browsers. Remove deletes only the values Family Guardian set and leaves the
          policy keys behind, possibly empty, because other policies may live in them. Private windows and guest mode
          work again afterwards; while the policy is active, guest mode is blocked.
        </li>
      </ol>
    </div>
  );
}

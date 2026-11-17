# Chrome Web Store listing

Visibility: **Unlisted** (only people with the link can install; force-install via policy works).

## Package

```bash
npm run zip -w extension
```

Upload `apps/extension/.output/extension-<version>-chrome.zip`.

## Store listing

- Name: Family Guardian
- Summary (max 132 chars): Shows parents which websites are used and for how long, and blocks sites they choose. Collects domains and time only.
- Category: Tools (or Family, if offered)
- Language: English
- Description:

  Family Guardian is a parental-control extension for a child's computer, set up by a parent.

  - See which websites are used and for how long, by day and week
  - Block websites or whole categories
  - A daily focus score: homework time versus distractions
  - Alert when the extension is removed or stops reporting

  Privacy first: only the website domain (e.g. youtube.com) and time are sent to the parent's dashboard. Never full addresses, page content, searches, messages, keystrokes or screenshots.

  Requires a parent account at https://family-guardian-one.vercel.app.

- Icon: `apps/extension/public/icon/128.png`
- Screenshots (1280x800): add once the dashboard shows data
- Privacy policy URL: https://family-guardian-one.vercel.app/privacy
- Homepage URL: https://family-guardian-one.vercel.app

## Privacy practices tab

- Single purpose: Lets a parent see how much time their child spends on each website and block sites the parent chooses.
- Permission justifications:
  - `tabs`: read the active tab's URL to derive its domain for time tracking
  - `idle`: stop counting time when the computer is idle or locked
  - `storage`: keep the device token, block rules and unsent usage while offline
  - `alarms`: send a usage report once a minute
  - `declarativeNetRequest`: block sites the parent chose before they load
  - Host permission `<all_urls>`: domain tracking and blocking must work on any website the child visits
- Remote code: No
- Data usage: "Web history" (domains only) and "User activity" (time spent). Not sold, not used for unrelated purposes, not used for creditworthiness.
- Certify the developer program policies.

## Plan

1. Register the developer account ($5, owner).
2. Upload the current build as a **draft** now to get the permanent extension ID (needed for the `.reg` installer, issue #17). Do not submit for review yet: a skeleton may be rejected for minimal functionality.
3. Submit for review once tracking + pairing work (issues #4, #11), target day 3.

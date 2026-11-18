# Chrome Web Store listing

Visibility: **Unlisted** (only people with the link can install; force-install via policy works).

## Package

```bash
npm run zip -w extension
```

Build with the production API URL and upload `apps/extension/.output/extension-<version>-chrome.zip`:

```bash
WXT_API_BASE_URL=https://family-guardian.co npm run zip -w extension
```

## Store listing

- Name: Family Guardian
- Summary (max 132 chars): Shows parents which websites are used and for how long. Collects website domains and time only.
- Category: Tools (or Family, if offered)
- Language: English
- Description:

  Family Guardian is a parental-control extension for a child's computer, set up by a parent.

  - See which websites are used and for how long, by day and week
  - Block websites or whole categories
  - Daily time limits per category (e.g. games 60 minutes), with the minutes left shown on the toolbar icon
  - Allowed hours: no browsing outside a daily window set by the parent
  - A daily focus score: homework time versus distractions
  - A daily or weekly e-mail digest for parents

  Privacy first: only the website domain (e.g. youtube.com) and time are sent to the parent's dashboard. Never full addresses, page content, searches, messages, keystrokes or screenshots.

  Requires a parent account at https://family-guardian.co.

- Icon: `apps/extension/public/icon/128.png`
- Screenshots (1280x800): add once the dashboard shows data
- Privacy policy URL: https://family-guardian.co/privacy
- Homepage URL: https://family-guardian.co

## Privacy practices tab

- Single purpose: Lets a parent see how much time their child spends on each website and block sites the parent chooses.
- Permission justifications:
  - `tabs`: read the active tab's URL to derive its domain for time tracking
  - `idle`: stop counting time when the computer is idle or locked
  - `storage`: keep the device token, block rules and unsent usage while offline
  - `alarms`: send a usage report once a minute
  - `declarativeNetRequest` (since 0.3.0): block the websites and categories the parent chose, apply daily time limits and allowed hours by redirecting blocked pages to the extension's own "blocked" page. Rules are applied in the browser; no page content is read.
  - `action` manifest key (toolbar icon with a title; no new permission): shows the minutes-left badge when a daily limit is about to run out
  - Host permission `https://family-guardian.co/*`: send usage reports to the parent's dashboard and fetch the parent's rules (our own API only)
  - Host permission `<all_urls>` (since 0.3.0): required by `declarativeNetRequest` redirect rules so a blocked site on any domain can be redirected to the blocked page. Pages are never read or modified otherwise.
- Remote code: No
- Data usage: "Web history" (domains only) and "User activity" (time spent). Not sold, not used for unrelated purposes, not used for creditworthiness.
- Certify the developer program policies.

## Versions

| Version | Contents |
|---|---|
| 0.2.0 | Tracking, pairing, heartbeat (minimal permissions) |
| 0.3.0 | Site and category blocking, daily limits per category, minutes-left badge, allowed hours, API origin `https://family-guardian.co` |

## Plan

1. Register the developer account ($5, owner).
2. Upload the current build as a **draft** now to get the permanent extension ID (needed for the `.reg` installer, issue #17). Do not submit for review yet: a skeleton may be rejected for minimal functionality.
3. Submit for review once tracking + pairing work (issues #4, #11), target day 3.

# Design

- The browser timezone is read on the client with `Intl.DateTimeFormat().resolvedOptions().timeZone` through `useSyncExternalStore` (server snapshot `UTC`). No cookie, no extra query, no `?tz=` redirect: the server cannot know the browser timezone on the first request, and the usage pages' `?tz=` replace costs a second navigation.
- The zone label stays in the text so the server-rendered fallback is never mistaken for local time.
- No new dependency; `Intl` only.

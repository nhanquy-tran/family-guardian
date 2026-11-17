# 0002. Browser extension plus policy file, not a native agent

Date: 2026-11-17. Status: accepted.

## Context
Kids spend almost all laptop time in the browser. A native Windows agent needs signing, an installer, services and anti-tamper work. Family Haven proves the extension approach works.

## Decision
Build a Manifest V3 extension for Chrome, Edge and Brave. Lock it in with a generated `.reg` file that sets `ExtensionInstallForcelist` and disables incognito via browser policy.

## Consequences
- Simple install, no native code.
- Apps outside the browser, and Firefox, are not seen. We document using Microsoft Family Safety to block Firefox.
- The child must use a Standard (non-admin) Windows account, or they can delete the policy.
- Force-install on non-domain-joined Windows requires the extension to be on the Chrome Web Store (see 0009).

# Cookie and Analytics Notice

**Status:** Working draft — not legal advice
**Last repository review:** August 24, 2026
**Intended users:** Adults aged 18 and older only

This draft must be reconciled with the deployed infrastructure, contracts, business practices, supported launch locations, and applicable law. Confirmation items require approval by the proprietor, an authorized adult, and qualified legal counsel before publication.

## Essential technologies

Kindred may use:

- Clerk authentication and session technologies to keep users signed in and protect account requests.
- Browser storage for interface preferences such as theme, where supported.
- Security, load-balancing, or hosting cookies set by the production platform and identified in the final deployment inventory.

## Diagnostics and advertising

Sentry may process technical error, performance, log, and error-triggered session-replay information when configured. The reviewed configuration is intended to avoid direct user information and request-body capture, but production behavior, retention, and any browser storage must be verified.

No Google Analytics, Meta Pixel, advertising network, or similar advertising tracker was found in the reviewed repository. This notice must be updated before any such technology is enabled. Social links in the footer are ordinary outbound links; the site does not embed social feeds or pixels.

## Controls

Users can use browser controls to remove or block cookies, but blocking essential authentication storage may prevent sign-in or secure features from working.

> **Founder/legal confirmation required:** Inspect production response headers and browser storage. Identify cookie names, providers, and lifetimes; confirm Sentry, Clerk, and hosting behavior; and determine whether a consent manager is required in each supported launch location.

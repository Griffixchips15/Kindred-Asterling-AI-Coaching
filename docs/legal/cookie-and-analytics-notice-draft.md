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

Kindred does not load a third-party browser analytics or error-reporting SDK. Technical server and hosting logs may still be processed to operate, secure, and troubleshoot the service; their production retention and storage behavior must be verified.

No Google Analytics, Meta Pixel, advertising network, or similar advertising tracker was found in the reviewed repository. This notice must be updated before any such technology is enabled. Social links in the footer are ordinary outbound links; the site does not embed social feeds or pixels.

## Controls

Users can use browser controls to remove or block cookies, but blocking essential authentication storage may prevent sign-in or secure features from working.

> **Founder/legal confirmation required:** Inspect production response headers and browser storage. Identify cookie names, providers, and lifetimes; confirm Clerk and hosting behavior; and determine whether a consent manager is required in each supported launch location.

---
name: Scheduled reminders (cron + senders)
description: Non-obvious constraints for the in-process reminder scheduler and its SMS/email senders.
---

# Scheduled reminders

Morning / medication / evening nudges delivered by SMS (Twilio) and/or email (Resend), one every-minute in-process `node-cron` tick.

## Always-on requirement
The scheduler is an **in-process cron**, not an external job. It only fires while the API server is running.
**Why:** Autoscale deployments sleep when idle, so reminders silently never send there.
**How to apply:** deploy reminders on a **Reserved VM** (always-on). There is no external scheduler to fall back on.

## Senders fail SOFT (opposite of the Square gate)
Missing `TWILIO_*` / `RESEND_*` secrets don't lock anything — that channel reports "not configured" and is skipped; the other channel still sends and the settings page still saves.
**Why:** reminders are an optional enhancement, not an access gate; failing closed would needlessly block saving prefs.
**Contrast:** the subscription paywall fails *closed*. Don't copy that pattern here.

## Twilio Replit connector proxy is unusable here
The Twilio connector proxy returned error 20003 (auth) in this project, so **both** Twilio and Resend call their APIs directly using env secrets (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `RESEND_API_KEY/FROM_EMAIL`).
**How to apply:** don't try to route these through the connector proxy again unless 20003 is known fixed.

## Once-only delivery: reserve-before-send
`deliverOnce()` is atomic against overlapping ticks / multiple processes: it **reserves** the deliveries-ledger row first via `INSERT ... ON CONFLICT DO NOTHING ... RETURNING` and only the row's winner actually sends. A failed send **deletes** the reservation so a later in-window tick can retry (a permanent mark would strand it).
**Why:** a prior review flagged a check-then-insert race that could double-send.
Ledger unique key is `userId+type+localDate+doseTime+channel`; `doseTime` defaults to `""` (not NULL) so the unique index dedups (Postgres NULLs are never equal).

## Catch-up window, not exact HH:MM
A reminder fires on the first tick at/after its scheduled local time, up to `WINDOW_MIN` (10) minutes late (`isDueInWindow`).
**Why:** exact `HH:MM === now` matching silently drops a reminder whenever a tick runs long or is skipped; the window tolerates that while the ledger still guarantees once-only and long downtime can't replay stale ones.

## Known limitation (accepted at current scale)
The tick processes users sequentially with a `ticking` overlap guard; there's no sharding/queue. Fine for a single-owner + small-subscriber app. **Revisit** (chunking/cursor or a job queue) only if the user base grows enough that one tick could exceed the catch-up window.

import * as Sentry from "@sentry/react";

function sampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const defaultDsn =
  "https://080adac574f33f4a08f61fd6ac9049aa@o4511934456266753.ingest.us.sentry.io/4511957721415680";

Sentry.init({
  dsn: dsn || defaultDsn,
  enabled: import.meta.env.VITE_SENTRY_ENABLED !== "false",
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    // Preserve familiar browser logging while forwarding operational messages.
    // Never write coaching content, health data, auth tokens, or email addresses.
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  enableLogs: true,
  tracesSampleRate: sampleRate(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    0.1,
  ),
});

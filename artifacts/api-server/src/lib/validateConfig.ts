export function validateRuntimeConfig(): void {
  const missing: string[] = [];
  const requireValue = (name: string) => {
    if (!process.env[name]?.trim()) missing.push(name);
  };

  requireValue("DATABASE_URL");
  requireValue("PORT");
  requireValue("OLLAMA_BASE_URL");
  requireValue("OLLAMA_MODEL");

  if (process.env.NODE_ENV === "production") {
    requireValue("APP_PUBLIC_URL");
    requireValue("SUBSCRIPTION_OWNER_IDS");
    requireValue("RESEND_API_KEY");
    requireValue("RESEND_FROM_EMAIL");
    requireValue("CLERK_SECRET_KEY");
    requireValue("CLERK_PUBLISHABLE_KEY");
    requireValue("CLERK_WEBHOOK_SECRET");
  }

  if (process.env.HELCIM_PAYMENTS_ENABLED === "true") {
    for (const name of [
      "HELCIM_API_KEY",
      "HELCIM_WEBHOOK_SECRET",
      "HELCIM_YEARLY_PLAN_ID",
      "HELCIM_YEARLY_CHECKOUT_URL",
      "HELCIM_LIFETIME_CHECKOUT_URL",
      "HELCIM_LIFETIME_INVOICE_PREFIX",
      "HELCIM_PORTAL_URL",
    ]) {
      requireValue(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required runtime configuration: ${[...new Set(missing)].join(", ")}`,
    );
  }
}

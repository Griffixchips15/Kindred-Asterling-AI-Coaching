export function validateRuntimeConfig(): void {
  const missing: string[] = [];
  const requireValue = (name: string) => {
    if (!process.env[name]?.trim()) missing.push(name);
  };

  requireValue("MONGODB_URI");
  requireValue("MONGODB_DATABASE");
  requireValue("PORT");
  const uri = process.env.MONGODB_URI?.trim();
  if (uri && !/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://");
  }
  const databaseName = process.env.MONGODB_DATABASE?.trim();
  if (databaseName && !/^[A-Za-z0-9_-]{1,63}$/.test(databaseName)) {
    throw new Error(
      "MONGODB_DATABASE must contain only letters, numbers, underscores, or hyphens",
    );
  }
  const aiProvider = (process.env.AI_PROVIDER || "ollama").toLowerCase();
  if (aiProvider === "ollama") {
    requireValue("OLLAMA_BASE_URL");
    requireValue("OLLAMA_MODEL");
  } else if (aiProvider === "openai") {
    requireValue("OPENAI_API_KEY");
    requireValue("OPENAI_MODEL");
  } else if (aiProvider === "bedrock") {
    requireValue("AWS_REGION");
    requireValue("BEDROCK_MODEL_ID");
  } else if (!["disabled", "none", "off"].includes(aiProvider)) {
    throw new Error(
      "AI_PROVIDER must be one of: bedrock, ollama, openai, disabled",
    );
  }

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
      "HELCIM_CUSTOMER_REFERENCE_SECRET",
      "HELCIM_YEARLY_PLAN_ID",
      "HELCIM_YEARLY_CHECKOUT_URL",
      "HELCIM_LIFETIME_CHECKOUT_URL",
      "HELCIM_LIFETIME_INVOICE_PREFIX",
      "HELCIM_PORTAL_URL",
    ]) {
      requireValue(name);
    }
  }

  const calendarValues = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALENDAR_REDIRECT_URI",
    "CALENDAR_OAUTH_STATE_SECRET",
    "CALENDAR_TOKEN_ENCRYPTION_KEY",
  ];
  if (calendarValues.some((name) => process.env[name]?.trim())) {
    calendarValues.forEach(requireValue);
    const redirect = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
    if (redirect) {
      try {
        const url = new URL(redirect);
        const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
        if (
          url.protocol !== "https:" &&
          !(isLocal && url.protocol === "http:")
        ) {
          throw new Error("invalid protocol");
        }
        if (url.pathname !== "/api/calendar/callback") {
          throw new Error("invalid path");
        }
      } catch {
        throw new Error(
          "GOOGLE_CALENDAR_REDIRECT_URI must be an absolute HTTPS URL ending in /api/calendar/callback (HTTP is allowed only for localhost)",
        );
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required runtime configuration: ${[...new Set(missing)].join(", ")}`,
    );
  }
}

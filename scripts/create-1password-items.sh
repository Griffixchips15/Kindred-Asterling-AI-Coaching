#!/usr/bin/env bash
# =============================================================================
# 1Password Item Creation Script — Kindred Asterling AI Coaching
# =============================================================================
# Run: bash scripts/create-1password-items.sh
# Requires: `op` CLI authenticated (desktop integration or service account)

set -euo pipefail

VAULT="Kindred AI Server"

echo "Creating items in vault: $VAULT"
echo "---------------------------------------------------"

# ── 1. Database Development ─────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="Password" \
  --title="Kindred - Database Development" \
  --tags="environment/development,service/coolify" \
  "credential[concealed]="
echo "✓ Kindred - Database Development"

# ── 2. Database Production ──────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="Password" \
  --title="Kindred - Database Production" \
  --tags="environment/production,service/coolify" \
  "credential[concealed]="
echo "✓ Kindred - Database Production"

# ── 3. Session Secret ───────────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="Password" \
  --title="Kindred - Session Secret" \
  --tags="environment/development" \
  "credential[concealed]="
echo "✓ Kindred - Session Secret"

# ── 4. Anthropic Development ────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Anthropic Development" \
  --tags="environment/development,service/anthropic" \
  "api key[concealed]=" \
  "base url[text]=https://api.anthropic.com"
echo "✓ Kindred - Anthropic Development"

# ── 5. Anthropic Production ─────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Anthropic Production" \
  --tags="environment/production,service/anthropic" \
  "api key[concealed]=" \
  "base url[text]=https://api.anthropic.com"
echo "✓ Kindred - Anthropic Production"

# ── 6. Gemini Development ───────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Gemini Development" \
  --tags="environment/development,service/anthropic" \
  "api key[concealed]=" \
  "base url[text]=https://generativelanguage.googleapis.com"
echo "✓ Kindred - Gemini Development"

# ── 7. ElevenLabs Development ───────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - ElevenLabs Development" \
  --tags="environment/development,service/elevenlabs" \
  "api key[concealed]="
echo "✓ Kindred - ElevenLabs Development"

# ── 8. ElevenLabs Production ────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - ElevenLabs Production" \
  --tags="environment/production,service/elevenlabs" \
  "api key[concealed]="
echo "✓ Kindred - ElevenLabs Production"

# ── 9. Stripe Test ──────────────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Stripe Test" \
  --tags="environment/development,service/stripe" \
  "secret key[concealed]=" \
  "yearly price id[text]=" \
  "lifetime price id[text]=" \
  "webhook secret[concealed]="
echo "✓ Kindred - Stripe Test"

# ── 10. Stripe Production ───────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Stripe Production" \
  --tags="environment/production,service/stripe" \
  "secret key[concealed]=" \
  "yearly price id[text]=" \
  "lifetime price id[text]=" \
  "webhook secret[concealed]="
echo "✓ Kindred - Stripe Production"

# ── 11. Twilio Development ──────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Twilio Development" \
  --tags="environment/development,service/twilio" \
  "account sid[concealed]=" \
  "auth token[concealed]=" \
  "phone number[text]="
echo "✓ Kindred - Twilio Development"

# ── 12. Twilio Production ───────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Twilio Production" \
  --tags="environment/production,service/twilio" \
  "account sid[concealed]=" \
  "auth token[concealed]=" \
  "phone number[text]="
echo "✓ Kindred - Twilio Production"

# ── 13. Resend Development ──────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Resend Development" \
  --tags="environment/development,service/resend" \
  "api key[concealed]=" \
  "from email[text]="
echo "✓ Kindred - Resend Development"

# ── 14. Resend Production ───────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="API Credential" \
  --title="Kindred - Resend Production" \
  --tags="environment/production,service/resend" \
  "api key[concealed]=" \
  "from email[text]="
echo "✓ Kindred - Resend Production"

# ── 15. App Config ──────────────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="Secure Note" \
  --title="Kindred - App Config" \
  --tags="environment/development" \
  "calendar owner user id[text]=50312031" \
  "subscription bypass emails[text]=asterling.digital@pm.me,cybermonkey9647@gmail.com"
echo "✓ Kindred - App Config"

# ── 16. Owner Recovery Codes ────────────────────────────────────────────────
op item create \
  --vault="$VAULT" \
  --category="Secure Note" \
  --title="Kindred - Owner Recovery Codes" \
  "recovery codes[concealed]="
echo "✓ Kindred - Owner Recovery Codes"

echo ""
echo "---------------------------------------------------"
echo "All 16 items created."
echo "Now fill in the empty values with: op edit '<item title>'"

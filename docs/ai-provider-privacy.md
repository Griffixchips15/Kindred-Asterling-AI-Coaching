# AI provider data and privacy policy

`AI_PROVIDER=disabled` prevents chat content from leaving the application. `ollama`
uses the configured private Ollama endpoint. `openai` sends data to the configured
OpenAI-compatible hosted endpoint. Hosted-provider credentials must be injected only
into the API container's secret store. They must never be placed in browser builds,
`VITE_*` variables, client logs, or source control.

## Data that may be sent

Only data needed for the current coaching turn may be submitted:

- the bounded recent chat transcript and the current free-form message;
- preferred/first name, birthday, bio, motivational quote, struggles, strengths,
  and interests used by the coaching prompt;
- when the model explicitly invokes a tool, a bounded set of the user's recent
  morning logs, evening reports, body scans, habit/streak data, or today's
  medication schedule/status.

These fields can reveal health, mental-health, medication, and crisis information.
Do not add contact details, account identifiers, payment data, authentication data,
or records belonging to another user. Tool queries remain user-scoped and outputs
are size bounded.

The OpenAI-compatible request sets `store: false`. This requests no provider-side
storage where supported, but it is not a substitute for contractual controls and
does not make every compatible endpoint honor the option.

## Production approval gate

Before enabling any hosted provider with production health-related information,
the organization must document privacy/security and legal review, including data
processing terms, retention and training terms, subprocessors and data residency,
incident handling, deletion, access controls, and whether an appropriate healthcare
agreement is required. Keep `AI_PROVIDER=disabled` (or private Ollama) until that
review and contract are approved. Re-review before changing provider, model, base
URL, fields, tools, or provider account settings.

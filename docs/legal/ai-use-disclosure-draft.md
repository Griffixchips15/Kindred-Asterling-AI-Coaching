# AI Use Disclosure

**Status:** Working draft — not legal advice
**Last repository review:** August 24, 2026
**Intended users:** Adults aged 18 and older only

This draft must be reconciled with the deployed infrastructure, contracts, business practices, supported launch locations, and applicable law. Confirmation items require approval by the proprietor, an authorized adult, and qualified legal counsel before publication.

## Where AI is used

AI generates coaching-chat replies and may help form summaries or contextual guidance. The server can provide recent morning and evening assessments, body scans, habit information, medication status, profile details, and a title-free calendar-load signal when those sources are relevant to the current message.

## Context minimization

Kindred's context assembler selects source categories using the current interaction instead of injecting all stored data into every conversation. Retrieval is scoped to the signed-in user and bounded by item and character limits.

## Limitations

- AI output is probabilistic and may be inaccurate, incomplete, inconsistent, or inappropriate.
- Calendar-load categories describe scheduling density only. They are not diagnoses or psychological conclusions.
- Kindred does not have human feelings, professional credentials, or independent knowledge of facts outside the information and tools supplied to it.
- Important health, legal, financial, safety, or other consequential information requires a qualified human source.

## Providers and data use

Production AI inference is provided through AWS Bedrock. The server also supports locally operated Ollama and a configured OpenAI-compatible service, but those alternatives should not be described as production processors unless they are actually enabled.

> **Founder/legal confirmation required:** Confirm the AWS Bedrock model and processing region, retention, abuse monitoring, training policy, human-review access, and opt-out or consent choices. Confirm whether any alternative AI provider is enabled in production.

## Canadian privacy guidance

Review this disclosure against the [Canadian privacy regulators' principles for generative AI](https://www.priv.gc.ca/en/privacy-topics/technology/artificial-intelligence/gd_principles_ai), including meaningful consent, appropriate purposes, openness, safeguards, and limits on retention and secondary use.

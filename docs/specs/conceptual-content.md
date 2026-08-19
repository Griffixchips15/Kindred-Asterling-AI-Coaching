# Conceptual Content Specification

## Goal

Explain Kindred's concept, purpose, and limits through a few high-information components rather than adding long marketing paragraphs.

## Core concept to communicate

Kindred is a structured reflection and coaching application. A user records selected check-ins and routines; when relevant, Kindred can retrieve a bounded portion of that user's own information to make an AI conversation less generic. It supports reflection and organization. It is not a person, clinician, diagnosis, treatment, or emergency service.

## Recommended content components

### “A day with Kindred” walkthrough

Three compact steps with a single example thread:

1. Begin: record mental load and one to three priorities.
2. Throughout: ask about a packed day; Kindred may use the relevant check-in or calendar-density signal.
3. Close: record what worked and what tomorrow needs.

Show exactly which data moves between steps. Use fictional, generic values and do not imply continuous monitoring.

### “What Kindred remembers” boundary panel

Two columns:

- May use when relevant: profile details, recent assessments, body scans, habits, medication status, and calendar event counts if connected.
- Does not mean: reading every record on every turn, monitoring outside the app, diagnosing from patterns, or replacing professional judgment.

Link this panel to the Privacy Policy and AI Use Disclosure.

### “Signal, not diagnosis” explainer

Use the calendar-load signal as the concrete example. Event counts may indicate an open, light, moderate, or high scheduling load. Explain that this is a planning cue derived from density, not an inference about stress, health, capacity, or performance.

### Claims-to-evidence map

On the Science page, connect each product behavior to the narrow evidence actually supporting it:

- Research source or framework.
- What design choice it informed.
- What the source does not prove about Kindred.

Avoid presenting books, films, or broad therapeutic traditions as clinical validation of the application.

### AI process disclosure

A four-step diagram: user message → relevance selection → bounded user context → configured AI model → response. Include clear notices that context values are user-provided, models can be wrong, and important decisions need qualified human input.

## Existing copy that needs resolution

- “Regulated presence”: identify the regulator or remove the word.
- “Not a chatbot”: clarify the meaningful product distinction without denying the chat interface.
- “Anchored in peer-reviewed science”: several listed sources are books or a film; use a more exact claim.
- “DBT and CBT … woven into the coaching framework”: document the actual implemented techniques and review ownership.
- “Your reflections stay yours”: reconcile with configured processors and the privacy disclosure.

## Content rules

- Prefer an example, boundary, or data-flow label over another aspirational paragraph.
- Name AI as AI and never imply feelings or human presence.
- Distinguish currently implemented behavior from roadmap intent.
- Place limitations next to the relevant capability, not only in the footer.
- Use “may” only where conditional behavior is real and explain the condition.

## Acceptance criteria

- The landing page can explain input, context selection, output, and limitations in under one screen on desktop and a short sequence on mobile.
- Every science or privacy claim links to evidence, deployed behavior, or an explicit confirmation item.
- Calendar load is described without medical or psychological interpretation.
- No new section duplicates the About, Science, AI Disclosure, or Privacy page.

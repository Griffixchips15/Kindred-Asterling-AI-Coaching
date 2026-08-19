# Interface Refinement Specification

## Scope

Focused refinement of the current React/Tailwind interface. Preserve the serif-led visual identity, muted palette, card system, and existing information architecture; do not redesign the product wholesale.

## Current strengths

- Public and signed-in layouts are clearly separated.
- Typography, borders, spacing, and primary-color treatment are consistent.
- Core daily actions have understandable destinations and restrained visual styling.
- Public pages already support responsive layouts and reusable cards/buttons.

## Priority refinements

### 1. Make the product model concrete

The landing page moves quickly from an abstract hero to a feature grid. Add one compact “how a day works” example showing Begin, a context-aware Kindred interaction, and Close with sample—not personal—data. This is a content component, not another large prose section.

### 2. Tighten credibility language

Replace or substantiate phrases such as “regulated presence,” “anchored in peer-reviewed science,” “evidence-based techniques … woven into the coaching framework,” and “private by design.” Use claim-level source links and distinguish design inspiration from demonstrated product efficacy.

### 3. Clarify state and recovery actions

- Calendar: distinguish not configured, not connected, expired/revoked access, and temporary Google failure.
- Chat: retain the user's unsent/retry text and make retry status clear without duplicating a stored turn.
- Assessments: show save errors and allow a deliberate correction flow after a daily entry.
- Payments: state whether tax, renewal, cancellation, and refund details appear before checkout.

### 4. Improve form scanning

- Keep labels directly above their fields now that microphone buttons are removed.
- Add concise optional/required text consistently instead of relying on placeholders.
- Use one vocabulary for saved states: “Saved,” “Logged,” or “Recorded,” chosen by domain.
- Verify focus order, visible focus, error association, touch target size, and reduced-motion behavior.

### 5. Strengthen navigation hierarchy

- Group public footer links into Explore, Legal, and configured social profiles.
- On mobile signed-in navigation, keep the four highest-frequency actions visually primary and move lower-frequency destinations into a secondary group.
- Make account, privacy/export/delete, and integration settings discoverable from a single account area.

### 6. Reduce repeated card rhythm

The public site uses similarly weighted cards for framework, features, principles, pricing, trust, and calls to action. Preserve cards where comparison matters, but use simpler rows or an annotated walkthrough for sequential or explanatory content. This creates hierarchy without new colors or illustration styles.

## Accessibility verification

- Test keyboard-only navigation, 200% zoom, screen-reader headings/landmarks, form error announcements, color contrast, and motion preferences.
- Confirm icon-only social links have accessible names and outbound-link treatment.
- Treat health and account content as plain-language content; avoid unexplained clinical abbreviations.

## Delivery order

1. Copy/claim corrections and state-specific error messages.
2. Form labels, focus, error behavior, and mobile navigation audit.
3. Product walkthrough and selective card reduction.
4. Usability test with five representative pilot tasks before broader visual changes.

## Success measures

- A first-time visitor can describe what Kindred does, what data it uses, and what it does not do after one landing-page scan.
- A user can identify and recover from disconnected Calendar, failed save, and failed chat-response states.
- Primary daily tasks are reachable without searching the full navigation.
- No public claim exceeds the evidence or configured product behavior.

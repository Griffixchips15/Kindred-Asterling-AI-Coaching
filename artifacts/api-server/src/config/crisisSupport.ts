/**
 * Clinically reviewed copy/configuration for the crisis interception path.
 *
 * Changes to this file require review by the Safety owner. Resource links are
 * checked quarterly and may be changed without changing chat/model prompts.
 */
export const CRISIS_SUPPORT_CONFIG = {
  review: {
    owner: "Safety",
    version: "2026-08-08",
    nextResourceReview: "2026-11-08",
  },
  response:
    "I'm sorry you're dealing with this. Kindred is not medical care or an emergency service. If you may act now or are in immediate danger, call your local emergency services now. Otherwise, use the crisis-resource region selector to find reviewed local support. If this alert does not apply, choose “This doesn’t apply” to continue.",
  falsePositiveLabel: "This doesn’t apply",
  // This neutral directory asks the person to select their own location. The
  // API does not infer, request, or retain country/region.
  regions: [
    {
      id: "international",
      label: "Choose my region",
      url: "https://findahelpline.com/",
    },
  ],
} as const;

export const SAFETY_EVENT_POLICY = {
  retentionClass: "security_safety_30d",
  maximumRetentionDays: 30,
  accessClass: "security_response_only",
  permittedRoles: ["security-incident-responder", "safety-lead"],
  purpose: "abuse monitoring and safety-control assurance",
} as const;

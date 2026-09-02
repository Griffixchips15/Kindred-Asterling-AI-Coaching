// Pure decision logic for the Today experience's "next gentle step".
//
// These functions derive a single, honest recommendation exclusively from real
// data (TodaySummary + today's medication dose status) and an explicitly
// injected current time, so behaviour is deterministic and testable without
// touching the network, the clock, or the DOM.

export interface TodayDose {
  /** HH:MM 24-hour scheduled time, e.g. "08:00". */
  scheduledTime: string;
  /** ISO timestamp of today's intake, or null when not yet recorded. */
  takenAt: string | null;
}

export interface TodayInputs {
  morningDone: boolean;
  eveningDone: boolean;
  bodyScansCount: number;
  habitsCompletedToday: number;
  totalHabits: number;
  /** Today's scheduled doses across all medications, or null while loading/on error. */
  doses: TodayDose[] | null;
  /** True when the medication schedule failed to load (error, not simply empty). */
  medicationsUnavailable: boolean;
  /** True while the medication schedule is still loading. */
  medicationsLoading: boolean;
}

export type NextStepKind =
  | "morning"
  | "medication"
  | "body-scan"
  | "habit"
  | "evening"
  | "on-track";

export interface NextStep {
  kind: NextStepKind;
  /** Route the action links to (an existing signed-in route). */
  href: string;
  /** Short imperative title. */
  title: string;
  /** Supporting body copy. */
  body: string;
  /** CTA label. */
  cta: string;
}

const EVENING_AFTER_HOUR = 17; // 5:00 PM

function minutesSinceMidnight(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map((n) => Number.parseInt(n, 10));
  return Math.max(0, Math.min(23, Number.isFinite(h) ? h : 0)) * 60 +
    Math.max(0, Math.min(59, Number.isFinite(m) ? m : 0));
}

/**
 * Returns the earliest scheduled dose whose time has arrived but isn't
 * recorded, regardless of the API's array order (selection is sorted by
 * scheduled time so it is deterministic across multiple medications).
 */
function dueUnrecordedDose(
  doses: TodayDose[],
  nowMinutes: number,
): TodayDose | null {
  const due = doses
    .filter((d) => !d.takenAt && minutesSinceMidnight(d.scheduledTime) <= nowMinutes)
    .sort((a, b) => minutesSinceMidnight(a.scheduledTime) - minutesSinceMidnight(b.scheduledTime));
  return due[0] ?? null;
}

/**
 * Compute the single most helpful next step for the signed-in user right now.
 *
 * Priority (first match wins):
 *   1. Morning check-in when incomplete.
 *   2. A scheduled medication dose whose time has arrived but is not recorded.
 *   3. Body scan when none has been recorded today.
 *   4. Incomplete habits when habits exist.
 *   5. Evening reflection after 5:00 PM when incomplete.
 *   6. Otherwise a calm "on track" state.
 *
 * `now` is injected (a Date); only its local hours/minutes are used. When the
 * medication data is unavailable, medication priority is skipped (never
 * assumed); every other fallback still applies.
 */
export function deriveNextStep(inputs: TodayInputs, now: Date): NextStep {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const pastEvening = now.getHours() >= EVENING_AFTER_HOUR;

  const doses = inputs.doses;

  // 1. Morning check-in.
  if (!inputs.morningDone) {
    return {
      kind: "morning",
      href: "/morning",
      title: "Begin your day",
      body: "Take a quiet moment to check in before the noise begins.",
      cta: "Start your morning check-in",
    };
  }

  // 2. A medication dose whose time has arrived but isn't recorded.
  //    Only when medication data actually loaded (doses !== null and not still
  //    loading) — never inferred from unknown or failed medication data. We
  //    never label it "missed" — just a gentle, time-aware prompt to record it.
  if (doses !== null && !inputs.medicationsUnavailable && !inputs.medicationsLoading) {
    const due = dueUnrecordedDose(doses, nowMinutes);
    if (due) {
      return {
        kind: "medication",
        href: "/medications",
        title: "Record your medication",
        body: `Your dose scheduled for ${due.scheduledTime} is ready to be marked as taken.`,
        cta: "Open medications",
      };
    }
  }

  // 3. Body scan.
  if (inputs.bodyScansCount === 0) {
    return {
      kind: "body-scan",
      href: "/scans",
      title: "Notice what's here",
      body: "A short body scan to ground yourself in the present moment.",
      cta: "Begin a body scan",
    };
  }

  // 4. Incomplete habits when habits exist.
  if (inputs.totalHabits > 0 && inputs.habitsCompletedToday < inputs.totalHabits) {
    return {
      kind: "habit",
      href: "/habits",
      title: "Tend a small habit",
      body: "A gentle step toward the consistency you're building.",
      cta: "Open your habits",
    };
  }

  // 5. Evening reflection after 5 PM.
  if (pastEvening && !inputs.eveningDone) {
    return {
      kind: "evening",
      href: "/evening",
      title: "Close the day",
      body: "Reflect on what worked and what tomorrow needs.",
      cta: "Start your evening reflection",
    };
  }

  // 6. Nothing actionable remaining.
  return {
    kind: "on-track",
    href: "/",
    title: "You're on track",
    body: "There's nothing pressing right now. Rest, or revisit anything above.",
    cta: "View today",
  };
}

export interface JourneyStep {
  anchor: "Begin" | "Notice" | "Tend" | "Close";
  label: string;
  href: string;
  /** Whether the anchor is satisfied by existing data. */
  complete: boolean;
  /** Short, truthful status copy; never an invented percentage. */
  status: string;
}

/**
 * Build the compact four-anchor daily journey from the same real inputs.
 *
 * Tend ("Habits & medication") is only marked complete from *known* data and
 * links to the destination that still needs attention: habits when habits are
 * incomplete, otherwise medication. Medication-only users therefore land on
 * /medications, never /habits. Unknown medication state (failure or still
 * loading) is surfaced truthfully instead of being treated as "nothing
 * scheduled" or "complete".
 */
export function deriveDailyJourney(inputs: TodayInputs): JourneyStep[] {
  const doses = inputs.doses;
  const doseCount = doses?.length ?? 0;
  const dosesRecorded = doses?.filter((d) => d.takenAt).length ?? 0;

  const habitsExist = inputs.totalHabits > 0;
  const habitsIncomplete =
    habitsExist && inputs.habitsCompletedToday < inputs.totalHabits;
  const habitsDone = habitsExist && !habitsIncomplete;

  // Resolve the Tend anchor status, href, and completeness truthfully.
  let tendStatus: string;
  let tendComplete: boolean;
  let tendHref: string;

  if (inputs.medicationsUnavailable) {
    // Failed: never claim "nothing scheduled", never mark complete.
    tendStatus = habitsExist && !habitsDone
      ? `${inputs.habitsCompletedToday} of ${inputs.totalHabits} habits done · Medication unavailable`
      : "Medication unavailable";
    tendComplete = habitsExist && habitsDone;
    tendHref = habitsIncomplete ? "/habits" : "/medications";
  } else if (inputs.medicationsLoading) {
    tendStatus = habitsExist && !habitsDone
      ? `${inputs.habitsCompletedToday} of ${inputs.totalHabits} habits done`
      : "Still loading";
    tendComplete = habitsExist && habitsDone;
    tendHref = habitsIncomplete ? "/habits" : "/medications";
  } else {
    // Medication data known (may be an empty schedule).
    const medsRecorded = doseCount > 0 && dosesRecorded === doseCount;
    const medsIncomplete = doseCount > 0 && !medsRecorded;
    const medsExist = doseCount > 0;

    const parts: string[] = [];
    if (medsExist) {
      parts.push(
        medsRecorded
          ? "Medication recorded"
          : `${dosesRecorded} of ${doseCount} doses recorded`,
      );
    }
    if (habitsExist) {
      parts.push(
        habitsDone
          ? "Habits complete"
          : `${inputs.habitsCompletedToday} of ${inputs.totalHabits} habits done`,
      );
    }

    tendStatus = parts.length > 0 ? parts.join(" · ") : "Nothing scheduled";
    tendComplete =
      (medsExist || habitsExist) && !medsIncomplete && !habitsIncomplete;
    tendHref = habitsIncomplete ? "/habits" : medsExist ? "/medications" : "/habits";
  }

  return [
    {
      anchor: "Begin",
      label: "Morning check-in",
      href: "/morning",
      complete: inputs.morningDone,
      status: inputs.morningDone ? "Completed" : "Not yet",
    },
    {
      anchor: "Notice",
      label: "Body scan",
      href: "/scans",
      complete: inputs.bodyScansCount > 0,
      status:
        inputs.bodyScansCount > 0
          ? `${inputs.bodyScansCount} scan${inputs.bodyScansCount === 1 ? "" : "s"} today`
          : "None yet",
    },
    {
      anchor: "Tend",
      label: "Habits & medication",
      href: tendHref,
      complete: tendComplete,
      status: tendStatus,
    },
    {
      anchor: "Close",
      label: "Evening reflection",
      href: "/evening",
      complete: inputs.eveningDone,
      status: inputs.eveningDone ? "Completed" : "Not yet",
    },
  ];
}

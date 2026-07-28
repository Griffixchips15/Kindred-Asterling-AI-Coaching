import cron, { type ScheduledTask } from "node-cron";
import { and, eq, isNull, lte, or, gt, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  reminderSettingsTable,
  reminderDeliveriesTable,
  medicationsTable,
  medicationScheduleEntriesTable,
} from "@workspace/db";
import { logger } from "./logger";
import { isSmsConfigured, sendSms } from "./twilio";
import { isEmailConfigured, sendEmail } from "./resend";

const DEFAULT_TZ = "America/New_York";

// Catch-up window (minutes). A reminder fires on the first tick at or after its
// scheduled local time, up to this many minutes late. This makes delivery robust
// to a slow/skipped tick (e.g. a tick that runs >60s) without firing stale
// reminders after long downtime. The deliveries ledger guarantees once-only.
const WINDOW_MIN = 10;

type ReminderType = "morning" | "evening" | "medication";

// Minutes-since-midnight for an "HH:MM" local time, or null if malformed.
function hmToMin(hm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// True if `scheduledMin` is due within the catch-up window ending at `nowMin`
// (i.e. scheduled time was 0..WINDOW_MIN minutes ago, same local day). We clamp
// at the start of the day so the window never crosses midnight into yesterday.
function isDueInWindow(scheduledMin: number, nowMin: number): boolean {
  const delta = nowMin - scheduledMin;
  return delta >= 0 && delta <= WINDOW_MIN;
}

interface DueReminder {
  type: ReminderType;
  // For medication, the dose "HH:MM"; otherwise "" (matches the deliveries ledger
  // default so dedup works for morning/evening too).
  doseTime: string;
  // Human text describing what's due (e.g. medication names), used in messages.
  detail?: string;
}

// Compute the user's local "HH:MM" and "YYYY-MM-DD" in their timezone.
function localParts(timezone: string, now: Date): { hm: string; date: string } {
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  } catch {
    tz = DEFAULT_TZ;
  }
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now); // "HH:MM"
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
  // en-GB can emit "24:00" at midnight on some runtimes; normalize to "00:00".
  return { hm: time === "24:00" ? "00:00" : time, date };
}

function appUrl(path: string): string {
  const base =
    process.env.APP_PUBLIC_URL ||
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "");
  if (!base) return "";
  return `${base.replace(/\/$/, "")}${path}`;
}

function greeting(name: string | null): string {
  return name ? `, ${name}` : "";
}

function buildMessage(
  due: DueReminder,
  name: string | null,
): { subject: string; text: string } {
  const hi = greeting(name);
  if (due.type === "morning") {
    const link = appUrl("/app/morning");
    return {
      subject: "Your morning check-in with Kindred",
      text: `Good morning${hi}. This is Kindred — a gentle nudge to check in with your morning mental-load when you have a moment.${link ? `\n\n${link}` : ""}`,
    };
  }
  if (due.type === "evening") {
    const link = appUrl("/app/evening");
    return {
      subject: "Time to wind down with Kindred",
      text: `Hi${hi}, it's Kindred. Time to wind down — your evening reflection is here whenever you're ready.${link ? `\n\n${link}` : ""}`,
    };
  }
  const link = appUrl("/app/medications");
  return {
    subject: "Medication reminder from Kindred",
    text: `Hi${hi}, it's Kindred. Time for your medication dose (${due.doseTime}). Open Kindred for details.${link ? `\n\n${link}` : ""}`,
  };
}

type Dose = { doseTime: string; names: string[] };

// Find medication doses whose schedule is active today and whose scheduled time
// is due within the catch-up window ending at `nowMin`. Returns one entry per
// distinct dose time, with the distinct medication names due at that time.
// Kept for tests or external callers, but we avoid N+1 by batching in runReminderTick
async function medsDueInWindow(
  userId: string,
  localDate: string,
  nowMin: number,
): Promise<Array<Dose>> {
  const rows = await db
    .select({
      name: medicationsTable.name,
      scheduledTime: medicationScheduleEntriesTable.scheduledTime,
    })
    .from(medicationScheduleEntriesTable)
    .innerJoin(
      medicationsTable,
      eq(medicationScheduleEntriesTable.medicationId, medicationsTable.id),
    )
    .where(
      and(
        eq(medicationScheduleEntriesTable.userId, userId),
        lte(medicationScheduleEntriesTable.startDate, localDate),
        or(
          isNull(medicationScheduleEntriesTable.endDate),
          gt(medicationScheduleEntriesTable.endDate, localDate),
        ),
      ),
    );

  const byTime = new Map<string, Set<string>>();
  for (const r of rows) {
    const sMin = hmToMin(r.scheduledTime);
    if (sMin === null || !isDueInWindow(sMin, nowMin)) continue;
    const set = byTime.get(r.scheduledTime) ?? new Set<string>();
    set.add(r.name);
    byTime.set(r.scheduledTime, set);
  }
  return Array.from(byTime.entries()).map(([doseTime, names]) => ({
    doseTime,
    names: Array.from(names),
  }));
}

// Try to send one reminder over one channel exactly once. To be atomic against
// overlapping ticks (or multiple processes), we *reserve* the deliveries-ledger
// row first via an atomic INSERT ... ON CONFLICT DO NOTHING: if no row comes
// back we lost the race (already sent/reserved) and bail. Only the winner sends.
// If the send fails we release the reservation so a later tick (still inside the
// catch-up window) can retry instead of marking it permanently done.
async function deliverOnce(
  userId: string,
  due: DueReminder,
  localDate: string,
  channel: "sms" | "email",
  destination: string,
  name: string | null,
): Promise<void> {
  const reserved = await db
    .insert(reminderDeliveriesTable)
    .values({
      userId,
      type: due.type,
      doseTime: due.doseTime,
      localDate,
      channel,
    })
    .onConflictDoNothing()
    .returning({ id: reminderDeliveriesTable.id });
  if (reserved.length === 0) return; // already sent or reserved by another tick

  const { subject, text } = buildMessage(due, name);
  const ok =
    channel === "sms"
      ? await sendSms(destination, text)
      : await sendEmail(destination, subject, text);
  if (!ok) {
    // Release the reservation so it can be retried within the catch-up window.
    await db
      .delete(reminderDeliveriesTable)
      .where(eq(reminderDeliveriesTable.id, reserved[0]!.id));
    return;
  }
  logger.info({ userId, type: due.type, channel }, "Reminder sent");
}

// Process a single user's due reminders for the current minute.
async function processUser(
  row: {
    userId: string;
    timezone: string | null;
    phone: string | null;
    email: string | null;
    preferredName: string | null;
    firstName: string | null;
    morningEnabled: boolean;
    morningTime: string;
    medicationEnabled: boolean;
    eveningEnabled: boolean;
    eveningTime: string;
    smsEnabled: boolean;
    emailEnabled: boolean;
  },
  now: Date,
  medsDue: Array<Dose> = [],
): Promise<void> {
  const { hm, date } = localParts(row.timezone ?? DEFAULT_TZ, now);
  const nowMin = hmToMin(hm);
  if (nowMin === null) return;
  const name = row.preferredName || row.firstName || null;

  const due: DueReminder[] = [];
  const morningMin = hmToMin(row.morningTime);
  if (
    row.morningEnabled &&
    morningMin !== null &&
    isDueInWindow(morningMin, nowMin)
  )
    due.push({ type: "morning", doseTime: "" });
  const eveningMin = hmToMin(row.eveningTime);
  if (
    row.eveningEnabled &&
    eveningMin !== null &&
    isDueInWindow(eveningMin, nowMin)
  )
    due.push({ type: "evening", doseTime: "" });
  if (row.medicationEnabled) {
    for (const dose of medsDue)
      due.push({
        type: "medication",
        doseTime: dose.doseTime,
        detail: dose.names.join(", "),
      });
  }
  if (due.length === 0) return;

  const channels: Array<{ ch: "sms" | "email"; to: string }> = [];
  if (row.smsEnabled && isSmsConfigured() && row.phone)
    channels.push({ ch: "sms", to: row.phone });
  if (row.emailEnabled && isEmailConfigured() && row.email)
    channels.push({ ch: "email", to: row.email });
  if (channels.length === 0) return;

  const promises: Promise<void>[] = [];
  for (const d of due) {
    for (const c of channels) {
      promises.push(
        deliverOnce(row.userId, d, date, c.ch, c.to, name).catch((err) => {
          logger.error(
            { err, userId: row.userId, type: d.type, channel: c.ch },
            "Reminder delivery failed",
          );
        })
      );
    }
  }
  await Promise.allSettled(promises);
}

let ticking = false;

export async function runReminderTick(now: Date = new Date()): Promise<void> {
  if (ticking) return; // don't overlap if a tick runs long
  ticking = true;
  try {
    const rows = await db
      .select({
        userId: reminderSettingsTable.userId,
        morningEnabled: reminderSettingsTable.morningEnabled,
        morningTime: reminderSettingsTable.morningTime,
        medicationEnabled: reminderSettingsTable.medicationEnabled,
        eveningEnabled: reminderSettingsTable.eveningEnabled,
        eveningTime: reminderSettingsTable.eveningTime,
        smsEnabled: reminderSettingsTable.smsEnabled,
        emailEnabled: reminderSettingsTable.emailEnabled,
        timezone: usersTable.timezone,
        phone: usersTable.phone,
        email: usersTable.email,
        preferredName: usersTable.preferredName,
        firstName: usersTable.firstName,
      })
      .from(reminderSettingsTable)
      .innerJoin(usersTable, eq(reminderSettingsTable.userId, usersTable.id))
      .where(
        and(
          or(
            eq(reminderSettingsTable.morningEnabled, true),
            eq(reminderSettingsTable.eveningEnabled, true),
            eq(reminderSettingsTable.medicationEnabled, true),
          ),
          or(
            eq(reminderSettingsTable.smsEnabled, true),
            eq(reminderSettingsTable.emailEnabled, true),
          ),
        ),
      );

    // Compute local time and catch-up window for each user.
    // Also batch fetch medication schedules to avoid N+1 queries.
    const userTimes = new Map<
      string,
      { hm: string; date: string; nowMin: number }
    >();
    const medUserIds: string[] = [];

    for (const row of rows) {
      const { hm, date } = localParts(row.timezone ?? DEFAULT_TZ, now);
      const nowMin = hmToMin(hm);
      if (nowMin !== null) {
        userTimes.set(row.userId, { hm, date, nowMin });
        if (row.medicationEnabled) {
          medUserIds.push(row.userId);
        }
      }
    }

    // Batch fetch medications
    const medsByUser = new Map<string, Array<Dose>>();
    if (medUserIds.length > 0) {
      const allMedRows = await db
        .select({
          userId: medicationScheduleEntriesTable.userId,
          name: medicationsTable.name,
          scheduledTime: medicationScheduleEntriesTable.scheduledTime,
          startDate: medicationScheduleEntriesTable.startDate,
          endDate: medicationScheduleEntriesTable.endDate,
        })
        .from(medicationScheduleEntriesTable)
        .innerJoin(
          medicationsTable,
          eq(medicationScheduleEntriesTable.medicationId, medicationsTable.id),
        )
        .where(inArray(medicationScheduleEntriesTable.userId, medUserIds));

      // Group by user and check dates/windows in memory
      for (const r of allMedRows) {
        const uTime = userTimes.get(r.userId);
        if (!uTime) continue; // Should not happen, but safeguard

        // Apply date bounds check
        if (r.startDate > uTime.date) continue;
        if (r.endDate !== null && r.endDate <= uTime.date) continue;

        // Apply window check
        const sMin = hmToMin(r.scheduledTime);
        if (sMin === null || !isDueInWindow(sMin, uTime.nowMin)) continue;

        // Valid dose
        let userMeds = medsByUser.get(r.userId);
        if (!userMeds) {
          userMeds = [];
          medsByUser.set(r.userId, userMeds);
        }

        let dose = userMeds.find((d) => d.doseTime === r.scheduledTime);
        if (!dose) {
          dose = { doseTime: r.scheduledTime, names: [] };
          userMeds.push(dose);
        }
        if (!dose.names.includes(r.name)) {
          dose.names.push(r.name);
        }
      }
    }

    for (const row of rows) {
      const uTime = userTimes.get(row.userId);
      if (!uTime) continue;
      const userMeds = medsByUser.get(row.userId) ?? [];
      await processUser(row, now, userMeds);
    }
  } catch (err) {
    logger.error({ err }, "Reminder tick failed");
  } finally {
    ticking = false;
  }
}

let task: ScheduledTask | null = null;

// Start the once-a-minute scheduler. Idempotent. Skips entirely in test.
export function startReminderScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (task) return;
  task = cron.schedule("* * * * *", () => {
    void runReminderTick();
  });
  logger.info("Reminder scheduler started (every minute)");
}

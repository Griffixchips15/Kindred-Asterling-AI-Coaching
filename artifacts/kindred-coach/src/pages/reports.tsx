import {
  useGetMedicationWeeklyReport,
  getGetMedicationWeeklyReportQueryKey,
  type MedicationWeeklyReportLogsItem,
  type MedicationWeeklyReportMedicationsItemScheduleItem,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { CalendarRange, Pill, Download } from "lucide-react";
import { cn } from "@/lib/utils";

async function downloadWeeklyPDF(getToken: () => Promise<string | null>) {
  const token = await getToken();
  const res = await fetch("/api/weekly-report/pdf", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Unable to download report (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kindred-weekly-summary.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

type DoseState = "onTime" | "missed" | "upcoming";

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Build a local Date for a given "YYYY-MM-DD" + "HH:MM" so comparisons against
// `now` use the device's local clock (no per-user timezone is stored).
function localDateTime(dateStr: string, hhmm: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
}

const HOUR_MS = 60 * 60 * 1000;

function doseState(
  dateStr: string,
  scheduledTime: string,
  log: MedicationWeeklyReportLogsItem | undefined,
  now: Date,
): DoseState {
  const scheduled = localDateTime(dateStr, scheduledTime);
  const deadline = new Date(scheduled.getTime() + HOUR_MS);
  if (log) {
    const taken = new Date(log.takenAt);
    // Taken within the 1-hour window is "on time"; taken late counts as missed.
    return taken.getTime() <= deadline.getTime() ? "onTime" : "missed";
  }
  // No log: missed once the 1-hour window has passed, otherwise still upcoming.
  return now.getTime() > deadline.getTime() ? "missed" : "upcoming";
}

const STATE_META: Record<
  DoseState,
  { label: string; dot: string; text: string }
> = {
  onTime: {
    label: "On time",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  missed: {
    label: "Missed",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
};

// Times scheduled on a given day, per the schedule history: a time applies to
// day D iff startDate <= D AND (endDate is null OR D < endDate). De-duplicated
// and sorted so a time re-added after removal isn't shown twice.
function activeTimesForDay(
  schedule: MedicationWeeklyReportMedicationsItemScheduleItem[],
  dateStr: string,
): string[] {
  const times = new Set<string>();
  for (const s of schedule) {
    if (s.startDate <= dateStr && (s.endDate === null || dateStr < s.endDate)) {
      times.add(s.scheduledTime);
    }
  }
  return Array.from(times).sort();
}

function dayLabels(dateStr: string): { weekday: string; day: string } {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (mo ?? 1) - 1, d ?? 1);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    day: String(d),
  };
}

export default function Reports() {
  const { getToken } = useAuth();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const now = new Date();
  // Send the device's UTC offset so the server builds the day grid, window, and
  // createdDate in the same local day the doses were recorded under.
  const tzOffset = now.getTimezoneOffset();
  const params = { tzOffset };
  const { data, isLoading } = useGetMedicationWeeklyReport(params, {
    query: { queryKey: getGetMedicationWeeklyReportQueryKey(params) },
  });

  const days = data?.days ?? [];
  const meds = data?.medications ?? [];

  // Index logs by medicationId|date|scheduledTime for O(1) lookup.
  const logMap = new Map<string, MedicationWeeklyReportLogsItem>();
  for (const l of data?.logs ?? []) {
    logMap.set(`${l.medicationId}|${l.date}|${l.scheduledTime}`, l);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-serif text-primary tracking-tight">
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your last 7 days of medication doses at a glance — whether each was
          taken on time or missed.
        </p>
      </header>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setDownloadError(null);
            setDownloading(true);
            void downloadWeeklyPDF(getToken)
              .catch(() =>
                setDownloadError(
                  "The weekly summary could not be downloaded. Please try again.",
                ),
              )
              .finally(() => setDownloading(false));
          }}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          data-testid="button-download-weekly-pdf"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing Summary…" : "Download Weekly Summary"}
        </button>
      </div>
      {downloadError && (
        <p className="text-right text-xs text-destructive" role="alert">
          {downloadError}
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {(Object.keys(STATE_META) as DoseState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={cn("w-2.5 h-2.5 rounded-full", STATE_META[s].dot)}
            />
            <span className="text-muted-foreground">{STATE_META[s].label}</span>
          </span>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && meds.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <CalendarRange
            className="w-8 h-8 mx-auto text-muted-foreground/60"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            No medications to report yet. Add medications to see your weekly
            history here.
          </p>
        </div>
      )}

      {!isLoading && meds.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card text-left font-medium text-muted-foreground px-3 py-2.5 min-w-[8rem]">
                  Medication
                </th>
                {days.map((d) => {
                  const { weekday, day } = dayLabels(d);
                  const isToday = d === days[days.length - 1];
                  return (
                    <th
                      key={d}
                      className={cn(
                        "px-2 py-2.5 text-center font-medium min-w-[3rem]",
                        isToday ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <div className="text-[11px] uppercase tracking-wide">
                        {weekday}
                      </div>
                      <div className="text-xs">{day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {meds.map((med) => (
                <tr
                  key={med.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-3 align-top">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{med.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {med.dosage}
                        </div>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const activeTimes =
                      d < med.createdDate
                        ? []
                        : activeTimesForDay(med.schedule, d);
                    return (
                      <td key={d} className="px-2 py-3 align-top">
                        <div className="flex flex-col items-center gap-1.5">
                          {activeTimes.length === 0 ? (
                            <span
                              title={
                                d < med.createdDate
                                  ? "Before this medication was added"
                                  : "Nothing scheduled this day"
                              }
                              className="text-muted-foreground/30 text-xs leading-none py-1"
                            >
                              —
                            </span>
                          ) : (
                            activeTimes.map((t) => {
                              const log = logMap.get(`${med.id}|${d}|${t}`);
                              const state = doseState(d, t, log, now);
                              const meta = STATE_META[state];
                              return (
                                <span
                                  key={t}
                                  title={`${formatTimeLabel(t)} — ${meta.label}`}
                                  data-testid={`cell-${med.id}-${d}-${t}`}
                                  className="flex flex-col items-center gap-0.5"
                                >
                                  <span
                                    className={cn(
                                      "w-3 h-3 rounded-full",
                                      meta.dot,
                                    )}
                                  />
                                  <span className="text-[9px] leading-none text-muted-foreground/70">
                                    {t}
                                  </span>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMedications,
  getListMedicationsQueryKey,
  createMedication,
  updateMedication,
  deleteMedication,
  logMedicationTaken,
  unlogMedicationTaken,
  type MedicationWithStatus,
} from "@workspace/api-client-react";
import { Pill, Plus, Pencil, Trash2, Check, X, Clock, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  dosage: string;
  timeOfDay: string;
  notes: string;
};

const EMPTY_FORM: FormState = { name: "", dosage: "", timeOfDay: "08:00", notes: "" };
const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function ratingTone(n: number): string {
  if (n <= 3) return "text-amber-600 dark:text-amber-400";
  if (n <= 6) return "text-foreground";
  return "text-primary";
}

export default function Medications() {
  const qc = useQueryClient();
  const { data: meds = [], isLoading } = useListMedications({
    query: { queryKey: getListMedicationsQueryKey() },
  });

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(m: MedicationWithStatus) {
    setForm({
      name: m.name,
      dosage: m.dosage,
      timeOfDay: m.timeOfDay,
      notes: m.notes ?? "",
    });
    setEditingId(m.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: getListMedicationsQueryKey() });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.dosage.trim()) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.timeOfDay)) return;
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        timeOfDay: form.timeOfDay,
        notes: form.notes.trim() ? form.notes.trim() : null,
      };
      if (editingId === "new") {
        await createMedication(payload);
      } else if (typeof editingId === "number") {
        await updateMedication(editingId, payload);
      }
      cancelEdit();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this medication?")) return;
    setBusy(true);
    try {
      await deleteMedication(id);
      if (editingId === id) cancelEdit();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleTaken(m: MedicationWithStatus) {
    setBusy(true);
    try {
      if (m.takenToday) {
        await unlogMedicationTaken(m.id);
      } else {
        await logMedicationTaken(m.id, {});
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function rateEffectiveness(m: MedicationWithStatus, score: number) {
    setBusy(true);
    try {
      // Logging is idempotent on the server — this both marks-taken (if needed)
      // and sets the effectiveness in one call.
      await logMedicationTaken(m.id, { effectiveness: score });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const todayCount = meds.filter((m) => m.takenToday).length;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-primary tracking-tight">Medications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your schedule, mark each dose as taken, and rate how well it's working — Kindred uses your ratings to spot patterns over time.
          </p>
        </div>
        <button
          onClick={startNew}
          disabled={editingId === "new"}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="add-medication"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </header>

      {!isLoading && meds.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">Today's intake</span>
          <span className="font-medium">
            {todayCount} / {meds.length} taken
          </span>
        </div>
      )}

      {editingId === "new" && (
        <MedForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          busy={busy}
          title="New medication"
        />
      )}

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && meds.length === 0 && editingId !== "new" && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Pill className="w-8 h-8 mx-auto text-muted-foreground/60" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-muted-foreground">
              No medications yet. Add one to start tracking.
            </p>
          </div>
        )}
        {meds.map((m) =>
          editingId === m.id ? (
            <MedForm
              key={m.id}
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={cancelEdit}
              busy={busy}
              title="Edit medication"
            />
          ) : (
            <MedRow
              key={m.id}
              med={m}
              onToggle={() => toggleTaken(m)}
              onEdit={() => startEdit(m)}
              onDelete={() => handleDelete(m.id)}
              onRate={(score) => rateEffectiveness(m, score)}
              busy={busy}
            />
          ),
        )}
      </div>
    </div>
  );
}

function MedRow({
  med,
  onToggle,
  onEdit,
  onDelete,
  onRate,
  busy,
}: {
  med: MedicationWithStatus;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (score: number) => void;
  busy: boolean;
}) {
  const taken = !!med.takenToday;
  const todayScore = med.effectivenessToday ?? null;
  const avg = med.recentEffectivenessAvg;
  const avgCount = med.recentEffectivenessCount;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        taken ? "border-primary/40 bg-primary/5" : "border-border",
      )}
      data-testid={`med-row-${med.id}`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={busy}
          className={cn(
            "w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            taken
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary/60",
          )}
          aria-label={taken ? "Mark as not taken" : "Mark as taken"}
          data-testid={`toggle-med-${med.id}`}
        >
          {taken && <Check className="w-5 h-5" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-medium truncate">{med.name}</h3>
            <span className="text-sm text-muted-foreground">{med.dosage}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimeLabel(med.timeOfDay)}</span>
            {taken && med.takenToday && (
              <span className="text-primary">
                · taken {format(parseISO(med.takenToday), "p")}
              </span>
            )}
            {avg !== null && avgCount > 0 && (
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                7-day avg{" "}
                <span className={cn("font-medium", ratingTone(Math.round(avg)))}>
                  {avg.toFixed(1)}/10
                </span>
                <span className="text-muted-foreground/70">({avgCount})</span>
              </span>
            )}
          </div>
          {med.notes && (
            <p className="text-xs text-muted-foreground/80 mt-1.5 italic">{med.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            disabled={busy}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Edit"
            data-testid={`edit-med-${med.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Delete"
            data-testid={`delete-med-${med.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Effectiveness rating row */}
      <div className="mt-3 pl-13 sm:pl-13">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <span>How well is it working today?</span>
          {todayScore !== null && (
            <span className={cn("font-medium", ratingTone(todayScore))}>
              {todayScore}/10
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Effectiveness 1 to 10">
          {RATING_VALUES.map((n) => {
            const selected = todayScore === n;
            return (
              <button
                key={n}
                onClick={() => onRate(n)}
                disabled={busy}
                role="radio"
                aria-checked={selected}
                aria-label={`Rate ${n} out of 10`}
                data-testid={`rate-med-${med.id}-${n}`}
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 text-xs font-medium rounded-md border transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
          1 = not helping · 10 = working really well. Rating also marks the dose as taken.
        </p>
      </div>
    </div>
  );
}

function MedForm({
  form,
  setForm,
  onSave,
  onCancel,
  busy,
  title,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  title: string;
}) {
  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{title}</h3>
        <button
          onClick={onCancel}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="e.g. Sertraline"
            data-testid="form-name"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Dosage</label>
          <input
            value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            className={inputClass}
            placeholder="e.g. 50mg"
            data-testid="form-dosage"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Time</label>
          <input
            type="time"
            value={form.timeOfDay}
            onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
            className={inputClass}
            data-testid="form-time"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
            placeholder="e.g. with food"
            data-testid="form-notes"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={busy || !form.name.trim() || !form.dosage.trim()}
          className="px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid="form-save"
        >
          Save
        </button>
      </div>
    </div>
  );
}

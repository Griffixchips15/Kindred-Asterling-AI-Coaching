import { Mic, Square, Loader2 } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  // Called with newly transcribed text. The parent decides how to merge it
  // (e.g. append to the current field value).
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

// Small mic button placed next to a text field. Tap to record, tap to stop;
// the recording is transcribed on the server and handed back via onTranscript.
export function VoiceInputButton({
  onTranscript,
  disabled,
  className,
}: VoiceInputButtonProps) {
  const { status, error, setError, supported, toggle } =
    useVoiceRecorder(onTranscript);

  if (!supported) return null;

  const recording = status === "recording";
  const transcribing = status === "transcribing";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || transcribing}
        aria-label={recording ? "Stop recording" : "Record with your voice"}
        title={recording ? "Stop recording" : "Record with your voice"}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full transition-colors shrink-0 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          recording
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-muted text-foreground hover:bg-muted/70",
          className,
        )}
        data-testid="voice-input-button"
      >
        {transcribing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : recording ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
      {(recording || transcribing) && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {recording ? "Listening…" : "Transcribing…"}
        </span>
      )}
      {error && (
        <button
          className="text-[11px] text-destructive max-w-[180px] text-right cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded"
          onClick={() => setError(null)}
          title="Dismiss"
          aria-label="Dismiss error"
        >
          {error}
        </button>
      )}
    </div>
  );
}

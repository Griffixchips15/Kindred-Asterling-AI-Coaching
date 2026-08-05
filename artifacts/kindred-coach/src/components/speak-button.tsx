import { useEffect, useRef, useState } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import { speakText, VoiceError } from "@/lib/voice-api";
import { cn } from "@/lib/utils";

interface SpeakButtonProps {
  text: string;
  className?: string;
}

type SpeakStatus = "idle" | "loading" | "playing";

// Speaker button shown on Kindred's chat replies. Tap to have the text read
// aloud in Kindred's voice (server-side ElevenLabs TTS); tap again to stop.
export function SpeakButton({ text, className }: SpeakButtonProps) {
  const [status, setStatus] = useState<SpeakStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  function teardown() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, []);

  async function handleClick() {
    // Tapping while loading or playing stops everything — including aborting an
    // in-flight TTS request so it can't resolve and auto-play after stop.
    if (status === "playing" || status === "loading") {
      teardown();
      setStatus("idle");
      return;
    }
    setError(null);
    setStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const blob = await speakText(text, controller.signal);
      // Bail if the user stopped (aborted) or the component unmounted while loading.
      if (controller.signal.aborted || !mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        teardown();
        if (mountedRef.current) setStatus("idle");
      };
      audio.onerror = () => {
        teardown();
        if (mountedRef.current) {
          setStatus("idle");
          setError("Couldn't play that.");
        }
      };
      await audio.play();
      if (mountedRef.current) setStatus("playing");
    } catch (err) {
      // Aborts are intentional (user stopped / unmount) — stay silent.
      if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
      teardown();
      if (mountedRef.current) {
        setStatus("idle");
        setError(err instanceof VoiceError ? err.message : "Couldn't play that.");
      }
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        aria-label={status === "playing" ? "Stop reading" : "Read aloud"}
        title={status === "playing" ? "Stop reading" : "Read aloud"}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
        data-testid="speak-button"
      >
        {status === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : status === "playing" ? (
          <Square className="w-3 h-3 fill-current" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
      </button>
      {error && (
        <button
          className="text-[11px] text-destructive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded"
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

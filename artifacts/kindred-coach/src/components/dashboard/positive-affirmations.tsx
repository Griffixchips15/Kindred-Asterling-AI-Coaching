import { useEffect, useState } from "react";
import {
  useListAffirmations,
  getListAffirmationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const ROTATION_MS = 7000;

export function PositiveAffirmations() {
  const { data, isLoading, isError } = useListAffirmations({
    query: { queryKey: getListAffirmationsQueryKey() },
  });

  const affirmations = data ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    if (index >= affirmations.length && affirmations.length > 0) {
      setIndex(0);
    }
  }, [affirmations.length, index]);

  useEffect(() => {
    if (paused || affirmations.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % affirmations.length);
      setFadeKey((k) => k + 1);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [paused, affirmations.length]);

  const goPrev = () => {
    if (affirmations.length === 0) return;
    setIndex((i) => (i - 1 + affirmations.length) % affirmations.length);
    setFadeKey((k) => k + 1);
  };
  const goNext = () => {
    if (affirmations.length === 0) return;
    setIndex((i) => (i + 1) % affirmations.length);
    setFadeKey((k) => k + 1);
  };

  const current = affirmations[index];

  return (
    <Card className="border-none shadow-sm bg-accent/10 overflow-hidden relative">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-full bg-accent/20 text-accent-foreground shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Affirmations
              </p>
              {affirmations.length > 1 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {index + 1} / {affirmations.length}
                </p>
              )}
            </div>
            <div className="min-h-[3.5rem] mt-2">
              {isLoading ? (
                <Skeleton className="h-6 w-3/4" />
              ) : isError || !current ? (
                <p className="font-serif text-lg leading-relaxed text-muted-foreground">
                  Be gentle with yourself today.
                </p>
              ) : (
                <p
                  key={fadeKey}
                  className="font-serif text-lg leading-relaxed text-foreground animate-in fade-in duration-700"
                  data-testid="affirmation-text"
                >
                  {current.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {affirmations.length > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">
              {affirmations.map((_, i) => (
                <span
                  key={i}
                  className={`block h-1 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous affirmation"
                data-testid="affirmation-prev"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Resume rotation" : "Pause rotation"}
                data-testid="affirmation-pause"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {paused ? (
                  <Play className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Pause className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next affirmation"
                data-testid="affirmation-next"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

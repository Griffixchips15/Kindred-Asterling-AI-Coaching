import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayAffirmation,
  getGetTodayAffirmationQueryKey,
  getRandomAffirmation,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { useState } from "react";

export function PositiveAffirmations() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetTodayAffirmation({
    query: { queryKey: getGetTodayAffirmationQueryKey() },
  });
  const [shuffling, setShuffling] = useState(false);

  const reshuffle = async () => {
    setShuffling(true);
    try {
      const next = await getRandomAffirmation();
      queryClient.setQueryData(getGetTodayAffirmationQueryKey(), next);
    } finally {
      setShuffling(false);
    }
  };

  return (
    <Card className="border-none shadow-sm bg-accent/10 overflow-hidden relative">
      <CardContent className="p-6 flex items-start gap-4">
        <div className="p-2.5 rounded-full bg-accent/20 text-accent-foreground shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            A thought for today
          </p>
          {isLoading ? (
            <Skeleton className="mt-2 h-6 w-3/4" />
          ) : isError || !data ? (
            <p className="mt-2 font-serif text-lg leading-relaxed text-muted-foreground">
              Be gentle with yourself today.
            </p>
          ) : (
            <p
              className="mt-2 font-serif text-lg leading-relaxed text-foreground"
              data-testid="affirmation-text"
            >
              {data.text}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={reshuffle}
          disabled={shuffling || isLoading}
          aria-label="Show another affirmation"
          data-testid="affirmation-reshuffle"
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${shuffling ? "animate-spin" : ""}`} strokeWidth={2} />
        </button>
      </CardContent>
    </Card>
  );
}

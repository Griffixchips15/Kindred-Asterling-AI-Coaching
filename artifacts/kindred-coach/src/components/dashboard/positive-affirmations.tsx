import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, RefreshCw } from "lucide-react";

const AFFIRMATIONS = [
  "You are exactly where you need to be today.",
  "Small steps in the right direction are still progress.",
  "Your calm is a quiet kind of strength.",
  "You are allowed to rest without earning it.",
  "Today's effort is enough, even when it feels small.",
  "You carry more wisdom than you give yourself credit for.",
  "Gentleness with yourself is not weakness — it's wisdom.",
  "You are becoming, and that takes time.",
  "Your feelings are valid, even the complicated ones.",
  "Breath by breath, you are finding your way.",
  "You do not have to be everything to everyone today.",
  "What you've already overcome speaks for what you can.",
  "You are worthy of the care you give to others.",
  "Today is a fresh page — write softly on it.",
  "Your presence matters more than your productivity.",
];

function affirmationForToday(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];
}

export function PositiveAffirmations() {
  const todays = useMemo(affirmationForToday, []);
  const [message, setMessage] = useState(todays);

  const reshuffle = () => {
    let next = message;
    while (next === message && AFFIRMATIONS.length > 1) {
      next = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
    }
    setMessage(next);
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
          <p className="mt-2 font-serif text-lg leading-relaxed text-foreground">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={reshuffle}
          aria-label="Show another affirmation"
          data-testid="affirmation-reshuffle"
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
        </button>
      </CardContent>
    </Card>
  );
}

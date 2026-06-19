// The Feelings Wheel — primary "core" emotions, each with secondary feelings,
// each of those with two more specific (tertiary) feelings. Used by the Body
// Scan picker so people can search or browse for the most precise word.

export interface FeelingGroup {
  secondary: string;
  tertiary: string[];
}

export interface CoreFeeling {
  name: string;
  // Full Tailwind class literals (kept whole so they survive purge).
  dot: string;
  groups: FeelingGroup[];
}

export const FEELINGS_WHEEL: CoreFeeling[] = [
  {
    name: "Happy",
    dot: "bg-amber-400",
    groups: [
      { secondary: "Playful", tertiary: ["Aroused", "Cheeky"] },
      { secondary: "Content", tertiary: ["Free", "Joyful"] },
      { secondary: "Interested", tertiary: ["Curious", "Inquisitive"] },
      { secondary: "Proud", tertiary: ["Successful", "Confident"] },
      { secondary: "Accepted", tertiary: ["Respected", "Valued"] },
      { secondary: "Powerful", tertiary: ["Courageous", "Creative"] },
      { secondary: "Peaceful", tertiary: ["Loving", "Thankful"] },
      { secondary: "Trusting", tertiary: ["Sensitive", "Intimate"] },
      { secondary: "Optimistic", tertiary: ["Hopeful", "Inspired"] },
    ],
  },
  {
    name: "Sad",
    dot: "bg-sky-400",
    groups: [
      { secondary: "Lonely", tertiary: ["Isolated", "Abandoned"] },
      { secondary: "Vulnerable", tertiary: ["Victimized", "Fragile"] },
      { secondary: "Despair", tertiary: ["Grief", "Powerless"] },
      { secondary: "Guilty", tertiary: ["Ashamed", "Remorseful"] },
      { secondary: "Depressed", tertiary: ["Inferior", "Empty"] },
      { secondary: "Hurt", tertiary: ["Embarrassed", "Disappointed"] },
    ],
  },
  {
    name: "Disgusted",
    dot: "bg-emerald-400",
    groups: [
      { secondary: "Disapproving", tertiary: ["Judgmental", "Loathing"] },
      { secondary: "Disappointed", tertiary: ["Appalled", "Revolted"] },
      { secondary: "Awful", tertiary: ["Nauseated", "Detestable"] },
      { secondary: "Repelled", tertiary: ["Horrified", "Hesitant"] },
    ],
  },
  {
    name: "Angry",
    dot: "bg-rose-500",
    groups: [
      { secondary: "Let down", tertiary: ["Betrayed", "Resentful"] },
      { secondary: "Humiliated", tertiary: ["Disrespected", "Ridiculed"] },
      { secondary: "Bitter", tertiary: ["Indignant", "Violated"] },
      { secondary: "Mad", tertiary: ["Furious", "Jealous"] },
      { secondary: "Aggressive", tertiary: ["Provoked", "Hostile"] },
      { secondary: "Frustrated", tertiary: ["Infuriated", "Annoyed"] },
      { secondary: "Distant", tertiary: ["Withdrawn", "Numb"] },
      { secondary: "Critical", tertiary: ["Skeptical", "Dismissive"] },
    ],
  },
  {
    name: "Fearful",
    dot: "bg-violet-400",
    groups: [
      { secondary: "Scared", tertiary: ["Helpless", "Frightened"] },
      { secondary: "Anxious", tertiary: ["Overwhelmed", "Worried"] },
      { secondary: "Insecure", tertiary: ["Inadequate", "Inferior"] },
      { secondary: "Weak", tertiary: ["Worthless", "Insignificant"] },
      { secondary: "Rejected", tertiary: ["Excluded", "Persecuted"] },
      { secondary: "Threatened", tertiary: ["Nervous", "Exposed"] },
    ],
  },
  {
    name: "Bad",
    dot: "bg-slate-400",
    groups: [
      { secondary: "Bored", tertiary: ["Indifferent", "Apathetic"] },
      { secondary: "Busy", tertiary: ["Pressured", "Rushed"] },
      { secondary: "Stressed", tertiary: ["Overwhelmed", "Out of control"] },
      { secondary: "Tired", tertiary: ["Sleepy", "Unfocused"] },
    ],
  },
  {
    name: "Surprised",
    dot: "bg-fuchsia-400",
    groups: [
      { secondary: "Startled", tertiary: ["Shocked", "Dismayed"] },
      { secondary: "Confused", tertiary: ["Disillusioned", "Perplexed"] },
      { secondary: "Amazed", tertiary: ["Astonished", "In awe"] },
      { secondary: "Excited", tertiary: ["Eager", "Energetic"] },
    ],
  },
];

export interface FeelingEntry {
  label: string;
  core: string;
}

// A flattened, de-duplicated list of every feeling (core + secondary +
// tertiary) for the search box. Duplicates (e.g. "Overwhelmed" appears under
// both Fearful and Bad) collapse to the first occurrence — the stored value is
// just the word, so one entry is enough.
export const ALL_FEELINGS: FeelingEntry[] = (() => {
  const seen = new Set<string>();
  const out: FeelingEntry[] = [];
  const add = (label: string, core: string) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, core });
  };
  for (const core of FEELINGS_WHEEL) {
    add(core.name, core.name);
    for (const group of core.groups) {
      add(group.secondary, core.name);
      for (const t of group.tertiary) add(t, core.name);
    }
  }
  return out;
})();

export function searchFeelings(query: string): FeelingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_FEELINGS.filter((f) => f.label.toLowerCase().includes(q));
}

import { Card, CardContent } from "@/components/ui/card";

const PILLARS = [
  {
    name: "Marc Lewis",
    title: "Addiction as Deep Learning",
    body: "Marc Lewis's argument: addiction is not pathology but deep learning. The brain's capacity to rewire itself is also the path to recovery.",
  },
  {
    name: "Kevin McCauley",
    title: "Hijacked Reward Circuits",
    body: "Kevin McCauley's work: how addiction hijacks the reward, memory, and stress circuits; how hypofrontality compromises choice and insight.",
  },
  {
    name: "Judith Grisel",
    title: "The Neurological Cycle",
    body: "Judith Grisel's neurological cycle: the brain's homeostatic rebound creates withdrawal, trapping people in a search for normalcy.",
  },
  {
    name: "The ACE Framework",
    title: "Environment & Genetics",
    body: "The interplay of Adverse Childhood Experiences, genetics, and environment in shaping the hedonic system.",
  },
];

export default function Science() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.16), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 pb-12 pt-20 text-center md:px-8 md:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-foreground md:text-5xl">
            Kindred is anchored in peer-reviewed science.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            We approach the mind with intellectual respect, drawing from cognitive
            neuroscience, addiction science, and behavioral health.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8">
        <h2 className="mb-8 text-center font-serif text-2xl font-medium tracking-tight text-foreground md:text-3xl">
          Research pillars
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {PILLARS.map((p) => (
            <Card key={p.name} className="h-full">
              <CardContent className="pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {p.name}
                </p>
                <h3 className="mt-2 font-serif text-xl font-medium text-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <Card>
          <CardContent className="px-6 py-10 md:px-10">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Evidence-Based Techniques
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Recovery as a process of reorganizing habits through social support
              and self-directed growth. Evidence-based therapeutic techniques —
              including DBT and CBT — are woven into the coaching framework to
              build distress tolerance and emotional regulation.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          The ethical landscape
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          AI can identify patterns and personalize support, but lacks emotional
          nuance. Human connection remains essential. Kindred is designed with
          this boundary clearly in mind.
        </p>
      </section>
    </div>
  );
}

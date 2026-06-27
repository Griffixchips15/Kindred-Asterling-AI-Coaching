import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const PILLARS = [
  {
    name: "Marc Lewis",
    title: "Addiction as Deep Learning",
    body: "Marc Lewis's argument: addiction is not pathology but deep learning. The brain's capacity to rewire itself is also the path to recovery.",
    source: {
      label: "The Biology of Desire (2015) — Basic Books",
      href: "https://www.basicbooks.com/titles/marc-lewis/the-biology-of-desire/9780465049165/",
    },
  },
  {
    name: "Kevin McCauley",
    title: "Hijacked Reward Circuits",
    body: "Kevin McCauley's work: how addiction hijacks the reward, memory, and stress circuits; how hypofrontality compromises choice and insight.",
    source: {
      label: "Pleasure Unwoven (2009) — Institute for Addiction Study",
      href: "https://www.instituteforaddictionstudy.com/pleasure-unwoven",
    },
  },
  {
    name: "Judith Grisel",
    title: "The Neurological Cycle",
    body: "Judith Grisel's neurological cycle: the brain's homeostatic rebound creates withdrawal, trapping people in a search for normalcy.",
    source: {
      label: "Never Enough (2019) — Doubleday",
      href: "https://www.penguinrandomhouse.com/books/567263/never-enough-by-judith-grisel/",
    },
  },
  {
    name: "The ACE Framework",
    title: "Environment & Genetics",
    body: "The interplay of Adverse Childhood Experiences, genetics, and environment in shaping the hedonic system.",
    source: {
      label: "Felitti et al. (1998) — American Journal of Preventive Medicine",
      href: "https://pubmed.ncbi.nlm.nih.gov/9635069/",
    },
  },
];

const BIBLIOGRAPHY = [
  {
    citation:
      "Lewis, M. (2015). The Biology of Desire: Why Addiction Is Not a Disease. Basic Books.",
    href: "https://www.basicbooks.com/titles/marc-lewis/the-biology-of-desire/9780465049165/",
  },
  {
    citation:
      "McCauley, K. (2009). Pleasure Unwoven: An Explanation of the Brain Disease of Addiction [Film]. Institute for Addiction Study.",
    href: "https://www.instituteforaddictionstudy.com/pleasure-unwoven",
  },
  {
    citation:
      "Grisel, J. (2019). Never Enough: The Neuroscience and Experience of Addiction. Doubleday.",
    href: "https://www.penguinrandomhouse.com/books/567263/never-enough-by-judith-grisel/",
  },
  {
    citation:
      "Felitti, V. J., Anda, R. F., Nordenberg, D., Williamson, D. F., Spitz, A. M., Edwards, V., … Marks, J. S. (1998). Relationship of childhood abuse and household dysfunction to many of the leading causes of death in adults. American Journal of Preventive Medicine, 14(4), 245–258.",
    href: "https://pubmed.ncbi.nlm.nih.gov/9635069/",
  },
  {
    citation:
      "Linehan, M. M. (1993). Cognitive-Behavioral Treatment of Borderline Personality Disorder. Guilford Press.",
    href: "https://www.guilford.com/books/Cognitive-Behavioral-Treatment-of-Borderline-Personality-Disorder/Linehan/9780898621839",
  },
  {
    citation:
      "Beck, A. T. (1979). Cognitive Therapy of Depression. Guilford Press.",
    href: "https://www.guilford.com/books/Cognitive-Therapy-of-Depression/Beck-Rush-Shaw-Emery/9780898629194",
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
              <CardContent className="flex h-full flex-col pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {p.name}
                </p>
                <h3 className="mt-2 font-serif text-xl font-medium text-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <a
                  href={p.source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {p.source.label}
                </a>
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

      <section className="mx-auto max-w-3xl px-5 pb-16 md:px-8">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          The ethical landscape
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          AI can identify patterns and personalize support, but lacks emotional
          nuance. Human connection remains essential. Kindred is designed with
          this boundary clearly in mind.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
        <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">
          Sources
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The research pillars and techniques described above draw on the
          following published works.
        </p>
        <ol className="mt-6 space-y-4">
          {BIBLIOGRAPHY.map((b, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span className="shrink-0 font-medium text-foreground">{i + 1}.</span>
              <span>
                {b.citation}{" "}
                <a
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View source
                </a>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function About() {
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
            Built from curiosity about the human brain.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Kindred was born from a genuine fascination with why we get stuck,
            why we reach for escape, and how we find our way back.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <Card>
          <CardContent className="px-6 py-10 md:px-10">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Our Mission
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We believe artificial intelligence should serve as a compassionate
              supplement to human care, never its replacement. Technology must
              strengthen human connection and resilience—guiding individuals to
              recognize patterns, evaluate progress, and mindfully return to
              their intentions. We commit to complete transparency: we identify
              the AI explicitly, state its boundaries plainly, and ensure human
              connection remains the cornerstone of recovery.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-12 md:px-8">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          A Note from the Creator
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Kindred Asterling emerged from lived experience and an enduring
          curiosity about the science of behavioral change. As a pilot
          initiative, it represents an honest exploration of how AI and human
          resilience intersect. We make no exaggerated claims—only a commitment
          to thoughtful, compassionate practice.
        </p>

        <h2 className="mt-8 font-serif text-2xl font-medium tracking-tight text-foreground">
          Review &amp; Medical Disclaimer
        </h2>
        <p className="mt-4 text-base italic leading-relaxed text-muted-foreground">
          Written and reviewed by the Kindred Asterling team.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Our team pairs lived recovery experience with rigorous study in
          cognitive neuroscience and addiction research. Kindred Asterling
          provides wellness and peer support; it is not a substitute for
          clinical medical or mental health treatment.
        </p>
        <p className="mt-6 text-base italic text-muted-foreground">
          Last reviewed: June 2026
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
        <Card className="overflow-hidden">
          <CardContent className="relative px-6 py-12 text-center md:px-10">
            <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground md:text-3xl">
              Explore the pilot
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              See the plans and start a free trial whenever you're ready.
            </p>
            <div className="mt-7 flex justify-center">
              <Button asChild size="lg">
                <Link href="/pricing">Explore membership</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

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
              Our mission
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We believe AI should be a transparent, compassionate supplement to
              human care — never a replacement for it. Technology should serve
              human connection and resilience, helping people identify patterns,
              reflect on progress, and gently return to their intentions. We hold
              ourselves to radical transparency: the AI is always named as AI, its
              limits are stated plainly, and human relationship remains at the
              center of recovery.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-12 md:px-8">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          A note from the creator
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Kindred Asterling grew out of lived experience and a long curiosity
          about the science of change. It is a pilot — an honest exploration of
          how AI and human resilience can meet. There are no grand promises here,
          only careful work and a commitment to doing it with compassion.
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
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

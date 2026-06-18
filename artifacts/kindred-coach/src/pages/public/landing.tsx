import { Link } from "wouter";
import {
  Pill,
  Activity,
  ClipboardCheck,
  LineChart,
  BookOpen,
  UserCircle,
  Palette,
  Sparkles,
  Sunrise,
  MessageCircle,
  Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MODULES = [
  {
    icon: Sunrise,
    title: "Begin",
    body: "An intentional opening to the day — mood, sleep quality, what's on the mind, and a single grounding intention before the noise begins.",
  },
  {
    icon: MessageCircle,
    title: "Throughout",
    body: "An ongoing conversation with Kindred — informed by your check-ins, your medications, your patterns, and the language you've used before.",
  },
  {
    icon: Sunset,
    title: "Close",
    body: "A reflective end-of-day pass — what worked, what didn't, what tomorrow needs. The brain consolidates what it rehearses.",
  },
];

const FEATURES = [
  {
    icon: Pill,
    title: "Medication Tracker",
    body: "A respectful, honest tracker for psychiatric medications. Adherence and side-effects belong in the same conversation as everything else.",
  },
  {
    icon: Activity,
    title: "Behavior Tracking",
    body: "Small, repeated actions tracked without shame — to give the brain something new to rehearse.",
  },
  {
    icon: ClipboardCheck,
    title: "Self-Assessments",
    body: "Brief, structured assessments grounded in DBT and CBT practice. Body scans, mood scans, urge scans.",
  },
  {
    icon: LineChart,
    title: "Progress View",
    body: "A longitudinal view of the work. Patterns emerge across weeks that no single day reveals.",
  },
  {
    icon: BookOpen,
    title: "Journal",
    body: "Past check-ins, conversations, and reflections — held with care.",
  },
  {
    icon: UserCircle,
    title: "Profile",
    body: "Name, birthday, interests, strengths, and what you're currently working on.",
  },
  {
    icon: Palette,
    title: "Customization",
    body: "Themes, language, the name you'd like to be called. Recovery is intimate work; the environment should respect that.",
  },
  {
    icon: Sparkles,
    title: "AI Companion",
    body: "Kindred is informed by your patterns and the language you've used before — not a generic profile from a market study.",
  },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "Radical Transparency",
    body: "The AI is named as AI. Its limits are stated, not hidden. Every suggestion is questionable, and questions are welcome.",
  },
  {
    n: "02",
    title: "Deep Personalization",
    body: "Built around your name, your medications, your strengths, your edges — not a generic user profile.",
  },
  {
    n: "03",
    title: "Complement, Not Replace",
    body: "Kindred is a companion to clinical care, peer support, and human relationship — not a replacement for any of them.",
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-20 text-center md:px-8 md:pt-28">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI grounded in cognitive neuroscience
          </p>
          <h1 className="font-serif text-4xl font-medium leading-[1.1] tracking-tight text-foreground md:text-6xl">
            Where neuroscience meets compassion.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Kindred is an AI companion grounded in cognitive neuroscience, mental
            health research, and addiction science — a transparent, regulated
            presence that serves human connection, never replaces it.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/pricing">Start Free Trial</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/science">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What is Kindred */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8">
        <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Not a chatbot. A companion.
        </h2>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          At the heart of the app is Kindred — born from genuine curiosity about
          the human brain, why we get stuck, why we reach for escape, and how we
          find our way back. We believe AI should be a transparent, compassionate
          supplement to human care. It helps us identify patterns, reflect our
          progress, and gently guide us back to our intentions. But it must never
          pretend to be human.
        </p>
      </section>

      {/* The Framework */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            A daily rhythm
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three moments that shape the day.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {MODULES.map((m) => (
            <Card key={m.title} className="h-full">
              <CardContent className="pt-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {m.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="bg-sidebar/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Everything in one place
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for the long, quiet work of caring for yourself.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="h-full">
                <CardContent className="pt-6">
                  <f.icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            What we hold to
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <Card key={p.n} className="h-full">
              <CardContent className="pt-6">
                <span className="font-serif text-3xl text-primary/40">{p.n}</span>
                <h3 className="mt-3 font-serif text-xl font-medium text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-8 md:px-8">
        <Card className="overflow-hidden">
          <CardContent className="relative px-6 py-14 text-center md:px-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(50% 80% at 50% 0%, hsl(var(--primary) / 0.16), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                Join the pilot.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                No promises, no spam. Just an invitation to follow the pilot and
                explore the intersection of AI and human resilience together.
              </p>
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg">
                  <Link href="/pricing">Get Early Access</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

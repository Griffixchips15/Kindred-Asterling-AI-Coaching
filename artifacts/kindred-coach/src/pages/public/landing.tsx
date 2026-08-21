import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONFIGURED_SOCIAL_LINKS } from "@/config/social-links";

const RHYTHM = [
  {
    icon: Sunrise,
    title: "Begin with intention",
    body: "Notice your mood, sleep, and mental load before the day gathers momentum.",
  },
  {
    icon: MessageCircle,
    title: "Reflect when you need to",
    body: "Talk through patterns, practise a different response, or prepare for human support.",
  },
  {
    icon: Sunset,
    title: "Close with perspective",
    body: "Name what helped, review what felt difficult, and make tomorrow feel more manageable.",
  },
];

const BENEFITS = [
  {
    icon: Brain,
    title: "Recognize patterns",
    body: "Bring daily reflections, habits, and check-ins into one clearer view.",
  },
  {
    icon: CalendarCheck,
    title: "Prepare for appointments",
    body: "Remember what changed between conversations with the people supporting you.",
  },
  {
    icon: HeartHandshake,
    title: "Support human care",
    body: "Use Kindred between appointments without treating AI as a replacement for professional help.",
  },
];

export default function Landing() {
  return (
    <div>
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-secondary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-80 w-80 rounded-full bg-background/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1.15fr_0.75fr] lg:py-32">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              <Sparkles className="h-4 w-4" /> Private AI coaching for daily
              life
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl font-medium leading-[1.02] tracking-[-0.04em] text-balance md:text-6xl lg:text-7xl">
              A steadier way to understand your patterns.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-primary-foreground/75 md:text-lg">
              Kindred Asterling is a private AI coaching companion for daily
              reflection, habit support, and honest conversations between the
              moments when human care is available.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Link href="/pricing">
                  Explore membership <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/about">See how Kindred works</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-primary-foreground/65">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-secondary" /> Private by
                design
              </span>
              <span className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-secondary" />{" "}
                Complements human care
              </span>
            </div>
          </div>

          <aside className="rounded-[1.5rem] border border-primary-foreground/15 bg-primary-foreground/[0.07] p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="flex items-center gap-2 border-b border-primary-foreground/15 pb-5 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary ring-4 ring-secondary/15" />
              A moment with Kindred
            </div>
            <blockquote className="my-7 font-serif text-2xl leading-relaxed text-primary-foreground">
              “You do not have to solve the whole week tonight. What would make
              the next hour feel more manageable?”
            </blockquote>
            <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm font-medium text-foreground">
              One small step
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </aside>
        </div>
      </section>

      <section
        className="border-b border-border bg-card/70"
        aria-label="Trust and safety"
      >
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 text-sm sm:grid-cols-3 md:px-8">
          <div>
            <p className="font-semibold text-foreground">
              Clearly identified AI
            </p>
            <p className="mt-1 text-muted-foreground">
              No pretending to be a person or clinician.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Your reflections stay personal
            </p>
            <p className="mt-1 text-muted-foreground">
              Designed around private, user-owned information.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Not crisis or medical care
            </p>
            <p className="mt-1 text-muted-foreground">
              Kindred supports—but does not replace—qualified help.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            A steadier daily rhythm
          </p>
          <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Support that fits into your day.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Each moment has a clear purpose, so reflection feels useful instead
            of overwhelming.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {RHYTHM.map(({ icon: Icon, title, body }, index) => (
            <Card
              key={title}
              className="h-full border-border/80 bg-card/80 shadow-sm"
            >
              <CardContent className="p-7">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-serif text-2xl text-primary/25">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-7 font-serif text-xl font-medium text-foreground">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/55">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Practical benefits
              </p>
              <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground">
                Turn reflection into something you can use.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Kindred helps organize the small signals that are difficult to
                see when every day is considered on its own.
              </p>
            </div>
            <div className="grid gap-4">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/25 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-serif text-lg font-medium text-foreground">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="bg-card/80">
            <CardContent className="p-7">
              <Brain className="h-6 w-6 text-primary" />
              <h2 className="mt-5 font-serif text-xl font-medium">
                Grounded in research
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The approach draws from cognitive neuroscience, behavioral
                health, and addiction research.
              </p>
              <Link
                href="/science"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Explore the science <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-7">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h2 className="mt-5 font-serif text-xl font-medium">
                Privacy and transparency
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Understand what Kindred is, what it remembers, and where its
                limitations begin.
              </p>
              <Link
                href="/legal/privacy"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Read the privacy policy <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-card/80">
            <CardContent className="p-7">
              <HeartHandshake className="h-6 w-6 text-primary" />
              <h2 className="mt-5 font-serif text-xl font-medium">
                Human care stays central
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Kindred is a wellness companion—not a therapist, medical
                service, or emergency resource.
              </p>
              <Link
                href="/legal/health-disclaimer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Read the health disclaimer <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {CONFIGURED_SOCIAL_LINKS.length > 0 && (
        <section className="border-y border-border bg-card/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div>
              <h2 className="font-serif text-xl font-medium text-foreground">
                Stay connected with Kindred
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Community news and practical encouragement.
              </p>
            </div>
            <nav
              className="flex flex-wrap gap-2"
              aria-label="Kindred Asterling social networks"
            >
              {CONFIGURED_SOCIAL_LINKS.map((social) => (
                <a
                  key={social.platform}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow Kindred Asterling on ${social.label}`}
                  title={social.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </nav>
          </div>
        </section>
      )}

      <section className="bg-primary px-5 py-20 text-center text-primary-foreground md:px-8 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
          Ready when you are
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-medium tracking-tight md:text-5xl">
          Make space for one honest next step.
        </h2>
        <Button
          asChild
          size="lg"
          className="mt-8 bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          <Link href="/pricing">
            Explore membership <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

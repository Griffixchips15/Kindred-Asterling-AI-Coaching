import { Check, ShieldCheck, Lock, HeartHandshake } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CheckoutButton } from "@/components/checkout-button";

const YEARLY_FEATURES = [
  "Full access to Kindred, your AI companion",
  "Daily Begin / Throughout / Close rhythm",
  "Medication & behavior tracking",
  "Self-assessments and progress view",
  "Journal, profile, and customization",
];

const LIFETIME_FEATURES = [
  "Everything in the yearly plan",
  "One payment, lifetime access",
  "All future features included",
  "Support the pilot directly",
];

const TRUST = [
  { icon: Lock, label: "Private by design — your reflections stay yours" },
  { icon: ShieldCheck, label: "Secure checkout powered by Stripe" },
  { icon: HeartHandshake, label: "A companion to care, never a replacement" },
];

export default function Pricing() {
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
        <div className="relative mx-auto max-w-3xl px-5 pb-10 pt-20 text-center md:px-8 md:pt-24">
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-foreground md:text-5xl">
            Simple, honest pricing.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Choose the plan that fits. You'll sign in first, then complete a
            secure checkout — access unlocks automatically once payment clears.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-10 md:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Yearly */}
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Yearly</CardTitle>
              <CardDescription>For the ongoing work.</CardDescription>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-serif text-4xl font-medium text-foreground">
                  $49.99
                </span>
                <span className="text-muted-foreground">/ year</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="flex-1 space-y-3">
                {YEARLY_FEATURES.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CheckoutButton
                  planType="yearly"
                  label="Start Yearly Plan"
                  variant="outline"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lifetime */}
          <Card className="relative flex h-full flex-col ring-1 ring-primary/40">
            <div className="absolute right-5 top-5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Best value
            </div>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Lifetime</CardTitle>
              <CardDescription>One payment. Forever.</CardDescription>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-serif text-4xl font-medium text-foreground">
                  $79.99
                </span>
                <span className="text-muted-foreground">once</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="flex-1 space-y-3">
                {LIFETIME_FEATURES.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CheckoutButton
                  planType="lifetime"
                  label="Get Lifetime Access"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24 md:px-8">
        <div className="grid gap-4 rounded-xl border border-border/60 bg-card/40 p-6 sm:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.label} className="flex items-start gap-3">
              <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm leading-snug text-muted-foreground">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

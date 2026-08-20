import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  Check,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Sunset,
} from "lucide-react";
import {
  FaFacebookF,
  FaGoogle,
  FaInstagram,
  FaLinkedinIn,
  FaPatreon,
} from "react-icons/fa";
import { SiThreads } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    id: "sage",
    name: "Quiet Sage",
    note: "Warm and reassuring",
    colors: ["#173b35", "#d8a86b", "#f3efe7"],
  },
  {
    id: "plum",
    name: "Modern Plum",
    note: "Confident and polished",
    colors: ["#331c3e", "#d6876d", "#fbf4ee"],
  },
  {
    id: "coastal",
    name: "Clear Coastal",
    note: "Open and optimistic",
    colors: ["#123c53", "#55a6a0", "#f1eee5"],
  },
  {
    id: "ink",
    name: "Editorial Ink",
    note: "Focused and thoughtful",
    colors: ["#151515", "#c8503c", "#f5f0e8"],
  },
  {
    id: "lavender",
    name: "Soft Lavender",
    note: "Gentle and personal",
    colors: ["#43365c", "#a88bb5", "#faf6f0"],
  },
  {
    id: "cobalt",
    name: "Bright Cobalt",
    note: "Direct and energetic",
    colors: ["#173c77", "#efb547", "#f7f4ec"],
  },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/", icon: FaFacebookF },
  { label: "Instagram", href: "https://www.instagram.com/", icon: FaInstagram },
  { label: "LinkedIn", href: "https://www.linkedin.com/", icon: FaLinkedinIn },
  { label: "Threads", href: "https://www.threads.net/", icon: SiThreads },
  {
    label: "Google Business",
    href: "https://www.google.com/search?q=Kindred+Asterling+AI+Coaching",
    icon: FaGoogle,
  },
  { label: "Patreon", href: "https://www.patreon.com/", icon: FaPatreon },
];

const RHYTHM = [
  {
    icon: Sunrise,
    title: "Begin with intention",
    body: "Notice your mood, your sleep, and what matters most today.",
  },
  {
    icon: MessageCircle,
    title: "Talk when you need to",
    body: "Reflect with a companion that remembers your goals and your language.",
  },
  {
    icon: Sunset,
    title: "Close with perspective",
    body: "See what helped, name what felt hard, and prepare for tomorrow.",
  },
];

export default function Landing() {
  const [theme, setTheme] = useState<ThemeId>("sage");
  return (
    <div className="concept-page" data-concept-theme={theme}>
      <section className="concept-hero">
        <div className="concept-orb concept-orb-one" />
        <div className="concept-orb concept-orb-two" />
        <div className="concept-hero-inner">
          <div className="concept-copy">
            <p className="concept-eyebrow">
              <Sparkles className="h-4 w-4" /> Thoughtful support for real life
            </p>
            <h1>Make room for the person you are becoming.</h1>
            <p className="concept-lede">
              Kindred Asterling helps you understand your patterns, practice new
              responses, and stay connected to the people and goals that matter.
            </p>
            <div className="concept-actions">
              <Button asChild size="lg" className="concept-primary">
                <Link href="/pricing">
                  Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="concept-secondary"
              >
                <Link href="/about">Meet Kindred</Link>
              </Button>
            </div>
            <div className="concept-trust">
              <span>
                <ShieldCheck /> Private by design
              </span>
              <span>
                <HeartHandshake /> Made to support human care
              </span>
            </div>
          </div>
          <aside className="concept-note" aria-label="A note from Kindred">
            <div className="concept-note-top">
              <span className="concept-pulse" /> A moment with Kindred
            </div>
            <blockquote>
              “You do not have to solve the whole week tonight. What would make
              the next hour feel more manageable?”
            </blockquote>
            <div className="concept-response">
              <span>One small step</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </aside>
        </div>
      </section>

      <section className="concept-social" aria-labelledby="social-heading">
        <div>
          <p id="social-heading">Stay connected with Kindred</p>
          <span>Ideas, community news, and practical encouragement.</span>
        </div>
        <nav aria-label="Kindred Asterling social networks">
          {SOCIALS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Follow Kindred Asterling on ${label}`}
            >
              <Icon />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </section>

      <section className="concept-rhythm">
        <div className="concept-section-heading">
          <p className="concept-kicker">A steadier daily rhythm</p>
          <h2>Support that fits into your day.</h2>
          <p>
            Kindred creates simple moments for reflection. Each one has a clear
            purpose, so caring for yourself feels possible rather than
            overwhelming.
          </p>
        </div>
        <div className="concept-rhythm-grid">
          {RHYTHM.map(({ icon: Icon, title, body }, index) => (
            <article key={title}>
              <div className="concept-number">0{index + 1}</div>
              <Icon />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="concept-proof">
        <div className="concept-proof-card">
          <Brain />
          <div>
            <p>Built with science. Written with care.</p>
            <span>
              Kindred draws from cognitive neuroscience, mental health research,
              and addiction science. It is always clear that you are talking
              with AI.
            </span>
          </div>
          <Link href="/science">
            Explore our approach <ArrowRight />
          </Link>
        </div>
      </section>

      <section className="concept-themes" aria-labelledby="theme-heading">
        <div className="concept-section-heading">
          <p className="concept-kicker">Six creative directions</p>
          <h2 id="theme-heading">Choose the feeling that fits.</h2>
          <p>
            Select a direction to preview its color, type, shape, and page
            composition above. Every option keeps the message direct and human.
          </p>
        </div>
        <div className="concept-theme-grid">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              className={cn(
                "concept-theme-card",
                theme === item.id && "is-active",
              )}
              aria-pressed={theme === item.id}
            >
              <span className="concept-swatches">
                {item.colors.map((color) => (
                  <i key={color} style={{ backgroundColor: color }} />
                ))}
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.note}</small>
              </span>
              {theme === item.id && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </section>

      <section className="concept-cta">
        <p>Ready when you are.</p>
        <h2>Take one honest step toward feeling better.</h2>
        <Button asChild size="lg" className="concept-primary">
          <Link href="/pricing">
            Explore membership <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

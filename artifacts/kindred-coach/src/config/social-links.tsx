import type { ComponentType } from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaThreads,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";
import { FaGoogle, FaPatreon } from "react-icons/fa";

export type SocialPlatform =
  | "whatsapp"
  | "instagram"
  | "threads"
  | "facebook"
  | "x"
  | "linkedin"
  | "google"
  | "patreon";

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
}

function validSocialUrl(
  value: string | null | undefined,
  hosts: string[],
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      url.protocol !== "https:" ||
      !hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

// The complete platform inventory lives here. A link is published only when a
// verified HTTPS profile URL is supplied, so placeholders can never send users
// to an invalid or unrelated account.
export const SOCIAL_LINKS: SocialLink[] = [
  {
    platform: "whatsapp",
    label: "WhatsApp",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_WHATSAPP_URL || "https://wa.me/15875946872",
      ["wa.me", "whatsapp.com"],
    ),
    icon: FaWhatsapp,
  },
  {
    platform: "instagram",
    label: "Instagram",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_INSTAGRAM_URL ||
        "https://www.instagram.com/griffixchips26/",
      ["instagram.com"],
    ),
    icon: FaInstagram,
  },
  {
    platform: "threads",
    label: "Threads",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_THREADS_URL ||
        "https://www.threads.net/@griffixchips26",
      ["threads.net"],
    ),
    icon: FaThreads,
  },
  {
    platform: "facebook",
    label: "Facebook",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_FACEBOOK_URL ||
        "https://www.facebook.com/profile.php?id=61590773082313",
      ["facebook.com", "fb.com"],
    ),
    icon: FaFacebookF,
  },
  {
    platform: "x",
    label: "X",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_X_URL || "https://x.com/Griffixchips",
      ["x.com", "twitter.com"],
    ),
    icon: FaXTwitter,
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    href: validSocialUrl(import.meta.env.VITE_SOCIAL_LINKEDIN_URL, [
      "linkedin.com",
    ]),
    icon: FaLinkedinIn,
  },
  {
    platform: "google",
    label: "Google Business",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_GOOGLE_BUSINESS_URL ||
        "https://share.google/N2VLKwW45pnL3eZ3A",
      ["share.google", "google.com"],
    ),
    icon: FaGoogle,
  },
  {
    platform: "patreon",
    label: "Patreon",
    href: validSocialUrl(
      import.meta.env.VITE_SOCIAL_PATREON_URL ||
        "https://patreon.com/kindred_ai",
      ["patreon.com"],
    ),
    icon: FaPatreon,
  },
];

export const CONFIGURED_SOCIAL_LINKS = SOCIAL_LINKS.filter(
  (link): link is SocialLink & { href: string } => Boolean(link.href),
);

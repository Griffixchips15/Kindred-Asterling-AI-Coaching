/**
 * Post-build prerender script.
 *
 * Runs after `vite build` to generate route-specific static HTML files for
 * every public marketing page. Each file gets its own <head> metadata
 * (title, description, canonical, Open Graph, Twitter Card, robots) and the
 * server-rendered page body — making content visible to AI crawlers, social
 * bots, and search engines without running JavaScript.
 *
 * Usage (called automatically by the `build` npm script):
 *   node scripts/prerender.mjs
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const SITE_NAME = "Kindred Asterling";

const ROUTES = [
  {
    path: "/",
    outputFile: "index.html",
    title: "Kindred Asterling — AI Coaching",
    description:
      "Kindred Asterling is your personal daily wellness companion and AI coach. Track habits, medications, and journal with AI support grounded in cognitive neuroscience.",
    ogTitle: "Kindred Asterling — AI Coaching",
    ogDescription:
      "Your personal daily wellness companion and AI coach — grounded in cognitive neuroscience.",
    robots: "index, follow",
  },
  {
    path: "/about",
    outputFile: "about/index.html",
    title: `About ${SITE_NAME} | AI Wellness Companion`,
    description:
      "Built from curiosity about the human brain. Learn how Kindred Asterling uses AI coaching informed by cognitive neuroscience to support your daily wellness journey.",
    ogTitle: `About ${SITE_NAME}`,
    ogDescription:
      "Built from curiosity about the human brain — an AI companion grounded in cognitive neuroscience.",
    robots: "index, follow",
  },
  {
    path: "/science",
    outputFile: "science/index.html",
    title: `The Science Behind ${SITE_NAME} | AI Wellness Coach`,
    description:
      "Kindred Asterling's approach is grounded in the neuroscience of habit, motivation, and change — drawing on the work of Marc Lewis, Kevin McCauley, Judith Grisel, and the ACE framework.",
    ogTitle: `The Science Behind ${SITE_NAME}`,
    ogDescription:
      "Habit, motivation, and change — the neuroscience framework behind Kindred Asterling.",
    robots: "index, follow",
  },
  {
    path: "/pricing",
    outputFile: "pricing/index.html",
    title: `${SITE_NAME} Pricing | AI Wellness Companion Plans`,
    description:
      "Compare Kindred Asterling plans and get started. AI-supported wellness check-ins, habit and medication tracking, and personal coaching — available as a yearly or lifetime membership.",
    ogTitle: `${SITE_NAME} Pricing`,
    ogDescription:
      "Compare plans for Kindred Asterling and get started with AI-supported wellness coaching.",
    robots: "index, follow",
  },
  {
    path: "/payment-success",
    outputFile: "payment-success/index.html",
    title: `Payment Successful | ${SITE_NAME}`,
    description: "Your payment was received. Accessing Kindred Asterling.",
    ogTitle: `Payment Successful | ${SITE_NAME}`,
    ogDescription: "Your payment was received.",
    robots: "noindex, nofollow",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductionOrigin() {
  if (process.env.APP_PUBLIC_URL) {
    return process.env.APP_PUBLIC_URL.replace(/\/+$/, "");
  }
  return "https://kindredasterling.com";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHead(route, origin) {
  const canonical = origin ? `${origin}${route.path === "/" ? "" : route.path}` : "";
  const ogImage = origin ? `${origin}/opengraph.jpg` : "/opengraph.jpg";

  const lines = [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="${route.robots}" />`,
  ];

  if (canonical) {
    lines.push(`<link rel="canonical" href="${canonical}" />`);
  }

  lines.push(
    `<meta property="og:title" content="${escapeHtml(route.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.ogDescription)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1280" />`,
    `<meta property="og:image:height" content="720" />`,
    `<meta property="og:image:alt" content="${escapeHtml(SITE_NAME)}" />`,
  );

  if (canonical) {
    lines.push(`<meta property="og:url" content="${canonical}" />`);
  }

  // twitter:site intentionally omitted: no official X/Twitter handle is finalized
  // yet. Add `<meta name="twitter:site" content="@handle" />` here (and in
  // index.html) once the brand account is confirmed.
  lines.push(
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(route.ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.ogDescription)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
  );

  return lines.join("\n    ");
}

// Replace the entire metadata block in the HTML shell. We match from
// <title> through the last twitter:description meta so we can swap it
// wholesale for each route's own block.
const META_PLACEHOLDER_RE =
  /<title>[\s\S]*?<\/title>[\s\S]*?(?=<link rel="icon")/;

function injectHead(template, headBlock) {
  return template.replace(META_PLACEHOLDER_RE, `${headBlock}\n    `);
}

function injectBody(template, bodyHtml) {
  return template.replace(
    '<div id="root"></div>',
    `<div id="root">${bodyHtml}</div>`,
  );
}

// ---------------------------------------------------------------------------
// Build SSR bundle
// ---------------------------------------------------------------------------

console.log("▶ Building SSR bundle…");
execSync(
  "node_modules/.bin/vite build --ssr src/entry-server.tsx --outDir dist/server --emptyOutDir",
  { cwd: root, stdio: "inherit" },
);

// ---------------------------------------------------------------------------
// Load SSR module and client template
// ---------------------------------------------------------------------------

const { render } = await import(`${root}/dist/server/entry-server.js`);
const template = readFileSync(`${root}/dist/public/index.html`, "utf-8");
const origin = getProductionOrigin();

if (origin) {
  console.log(`▶ Using production origin: ${origin}`);
} else {
  console.log(
    "▶ No APP_PUBLIC_URL / REPLIT_DOMAINS set — canonical URLs and absolute OG image URLs omitted.",
  );
}

// ---------------------------------------------------------------------------
// Render each route
// ---------------------------------------------------------------------------

for (const route of ROUTES) {
  process.stdout.write(`  Rendering ${route.path} → ${route.outputFile} … `);

  let bodyHtml = "";
  try {
    bodyHtml = render(route.path);
  } catch (err) {
    console.warn(`\n  ⚠ SSR render failed for ${route.path}: ${err.message}`);
  }

  const headBlock = buildHead(route, origin);
  let html = injectHead(template, headBlock);
  if (bodyHtml) {
    html = injectBody(html, bodyHtml);
  }

  const outPath = resolve(root, "dist/public", route.outputFile);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf-8");

  console.log("done");
}

console.log("✓ Prerender complete.");

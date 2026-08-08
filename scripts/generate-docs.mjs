import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "..", "docs");

const CONTACT = {
  website: "kindred-asterling-ai-coaching.com",
  email: "kindredaicoaching@gmail.com",
  phone: "587-594-6872",
};

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function addHeader(doc) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#1a1a2e")
    .text("KINDRED ASTERLING", { align: "center" });
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor("#555555")
    .text("Where neuroscience meets compassion", { align: "center" });
  doc.moveDown(0.5);
  const y = doc.y;
  doc
    .moveTo(50, y)
    .lineTo(doc.page.width - 50, y)
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(1);
}

function addFooter(doc, pageNum, totalPages) {
  const footerY = doc.page.height - 40;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#888888")
    .text(
      `${CONTACT.website}  |  ${CONTACT.email}  |  ${CONTACT.phone}`,
      50,
      footerY,
      { align: "center", width: doc.page.width - 100 }
    );
  if (totalPages > 1) {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#888888")
      .text(`Page ${pageNum} of ${totalPages}`, 50, footerY - 10, {
        align: "center",
        width: doc.page.width - 100,
      });
  }
}

function sectionTitle(doc, title) {
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#1a1a2e")
    .text(title);
  doc.moveDown(0.3);
}

function bodyText(doc, text) {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333")
    .text(text, { lineGap: 3 });
  doc.moveDown(0.3);
}

function bulletItem(doc, text) {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333")
    .text(`  \u2022  ${text}`, { lineGap: 2, indent: 10 });
}

function numberedItem(doc, num, text) {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333")
    .text(`  ${num}. ${text}`, { lineGap: 2, indent: 10 });
}

// ============================================================
// DOCUMENT 1: One-Pager
// ============================================================
function generateOnePager() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(
    path.join(OUTPUT_DIR, "kindred-one-pager.pdf")
  );
  doc.pipe(stream);

  addHeader(doc);

  sectionTitle(doc, "The Problem");
  bodyText(
    doc,
    "Mental health and recovery support is inaccessible, expensive, and stigmatized. 1 in 5 Canadians experience mental illness each year. Therapy costs $150-250/session. Wait times average 3-6 months. Most people suffering in silence have no structured daily support."
  );

  sectionTitle(doc, "The Solution");
  bodyText(
    doc,
    "Kindred is an AI wellness companion grounded in cognitive neuroscience and addiction science. It provides a structured daily rhythm \u2014 morning check-ins, AI-powered coaching conversations, body scans, evening reflections \u2014 alongside medication tracking, habit building, and personalized insights."
  );
  doc.moveDown(0.3);
  bodyText(doc, "Unlike generic chatbots, Kindred is:");
  bulletItem(
    doc,
    "Transparent \u2014 always identified as AI, limits stated plainly"
  );
  bulletItem(
    doc,
    "Personalized \u2014 built around your medications, strengths, patterns, and history"
  );
  bulletItem(
    doc,
    "Evidence-based \u2014 anchored in DBT, CBT, and peer-reviewed neuroscience research"
  );

  sectionTitle(doc, "How It Works");
  bodyText(
    doc,
    "Users follow a daily rhythm: Begin (morning check-in), Throughout (AI conversation with Kindred), Close (evening reflection). Kindred reads your check-ins, medications, and habits, then coaches you through the day with context-aware, brief, grounded responses. Voice input/output for accessibility. Medication adherence tracking with effectiveness ratings. SMS/email reminders in your timezone."
  );

  sectionTitle(doc, "Market");
  bodyText(
    doc,
    "$5.2 trillion global wellness market. $20B+ digital mental health market growing 20%+ annually. Canada alone spends $51B/year on mental health costs."
  );

  sectionTitle(doc, "Business Model");
  bodyText(
    doc,
    "$49.99/year or $79.99 lifetime. Subscription paywall via Square. Low barrier, high retention model."
  );

  sectionTitle(doc, "Traction");
  bodyText(
    doc,
    "Feature-complete platform with 12+ integrated features: AI chat, voice, medication tracking, habit tracking, morning/evening journals, body scans, weekly PDF reports, SMS/email reminders, calendar integration, and a science-backed marketing site."
  );

  sectionTitle(doc, "Team");
  bodyText(
    doc,
    "Built by a solo founder from lived experience with recovery and sustained study of cognitive neuroscience and addiction science. Edmonton, Alberta."
  );

  sectionTitle(doc, "The Ask");
  bodyText(
    doc,
    "$50,000\u2013$150,000 to complete beta testing, acquire first 500 users, and begin wearable integrations (Apple Health, Fitbit). Open to grants, accelerators, or angel investment."
  );

  addFooter(doc, 1, 1);
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ============================================================
// DOCUMENT 2: IRAP Narrative
// ============================================================
function generateIRAP() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(
    path.join(OUTPUT_DIR, "kindred-irap-narrative.pdf")
  );
  doc.pipe(stream);

  addHeader(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a2e")
    .text("Project Title: AI-Powered Wellness Companion with Neuroscience-Grounded Coaching");
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333")
    .text("Applicant: Kindred Asterling Inc. (federally incorporated, Edmonton AB)");
  doc.moveDown(0.8);

  sectionTitle(doc, "Project Summary");
  bodyText(
    doc,
    "Kindred Asterling is developing an artificial intelligence wellness companion that provides personalized, evidence-based daily support for mental health and recovery. The platform combines large language model (LLM) coaching with structured journaling, medication tracking, habit building, and behavioral health assessments."
  );

  sectionTitle(doc, "Technical Innovation");
  bodyText(doc, "The project addresses several technical uncertainties:");
  doc.moveDown(0.2);
  numberedItem(
    doc,
    1,
    'Agentic AI coaching with user context: Developing an AI system that dynamically accesses a user\'s health data (medications, habits, journal entries) mid-conversation to provide context-aware, personalized coaching \u2014 while maintaining strict data isolation and preventing prompt injection.'
  );
  doc.moveDown(0.3);
  numberedItem(
    doc,
    2,
    "Contract-first API architecture with transactional write validation: Implementing a novel pattern where every database write is validated against an OpenAPI schema inside the transaction, ensuring zero data integrity violations."
  );
  doc.moveDown(0.3);
  numberedItem(
    doc,
    3,
    "Timezone-aware idempotent reminder system: Building a distributed scheduler that delivers personalized SMS/email reminders across multiple timezones with exactly-once delivery guarantees."
  );
  doc.moveDown(0.3);
  numberedItem(
    doc,
    4,
    "Voice accessibility for health journaling: Integrating speech-to-text and text-to-speech for users who cannot type journal entries, with browser compatibility across mobile platforms."
  );
  doc.moveDown(0.3);
  numberedItem(
    doc,
    5,
    "Neuroscience-grounded AI persona: Developing a coaching AI that integrates principles from cognitive neuroscience (DBT, CBT, addiction science) while maintaining transparent boundaries about AI limitations."
  );

  sectionTitle(doc, "R&D Activities");
  bulletItem(
    doc,
    "Design and implementation of agentic tool-use architecture for LLM-based health coaching"
  );
  bulletItem(
    doc,
    "Development of transactional write-contract pattern for API data integrity"
  );
  bulletItem(
    doc,
    "Integration of multiple AI services (Anthropic Claude, ElevenLabs voice) with graceful degradation"
  );
  bulletItem(
    doc,
    "Security hardening for sensitive health data (rate limiting, per-user isolation, session management)"
  );
  bulletItem(
    doc,
    "Usability research and iterative design for wellness-focused user interfaces"
  );

  sectionTitle(doc, "Economic Benefits to Canada");
  bulletItem(
    doc,
    "Creating a Canadian-developed health technology product for the $20B+ digital mental health market"
  );
  bulletItem(
    doc,
    "Employing Canadian developers and designers (currently solo founder, planned hiring with funding)"
  );
  bulletItem(
    doc,
    "Contributing to Canada\u2019s AI ecosystem through novel applications of large language models in healthcare"
  );
  bulletItem(
    doc,
    "Potential for export to international markets (US, UK, Australia)"
  );

  sectionTitle(doc, "Current Stage");
  bodyText(
    doc,
    "The platform is feature-complete and deployed on Coolify (self-hosted). The R&D phase is approximately 80% complete. Additional funding is needed for beta testing, user acquisition, wearable device integration, and production hardening."
  );

  addFooter(doc, 1, 1);
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ============================================================
// DOCUMENT 3: Futurpreneur Answers
// ============================================================
function generateFuturpreneur() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(
    path.join(OUTPUT_DIR, "kindred-futurpreneur-answers.pdf")
  );
  doc.pipe(stream);

  addHeader(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a2e")
    .text("Futurpreneur Application \u2014 Prepared Answers");
  doc.moveDown(0.8);

  sectionTitle(doc, "Business Name");
  bodyText(doc, "Kindred Asterling Inc.");

  sectionTitle(doc, "Business Description (100 words)");
  bodyText(
    doc,
    "Kindred Asterling is an AI wellness companion that provides structured daily support for mental health and recovery. Users follow a morning-to-evening rhythm of check-ins, AI coaching conversations, and reflections, alongside medication tracking, habit building, and behavioral health assessments. The AI, named Kindred, is grounded in cognitive neuroscience and addiction science, providing personalized, transparent, evidence-based support. The platform runs as a subscription service ($49.99/year or $79.99 lifetime) and is deployed as a cloud-based web application accessible from any device."
  );

  sectionTitle(doc, "What problem does your business solve?");
  bodyText(
    doc,
    "Mental health and recovery support is inaccessible, expensive, and stigmatized. Therapy costs $150\u2013250/session in Canada. Wait times for public mental health services average 3\u20136 months. Most people experiencing mental health challenges have no structured daily support between appointments. Kindred fills this gap by providing an always-available, personalized, evidence-based wellness companion that helps users maintain daily structure, track medications, build habits, and reflect on their progress."
  );

  sectionTitle(doc, "What makes your business unique?");
  bodyText(doc, "Three things differentiate Kindred:");
  numberedItem(
    doc,
    1,
    "Neuroscience-grounded: Unlike generic wellness apps, Kindred is anchored in peer-reviewed research (DBT, CBT, addiction science, ACE framework). The AI coaching persona is designed with transparent boundaries."
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    2,
    "Agentic AI with user context: Kindred dynamically reads the user\u2019s medications, habits, and journal entries during conversations, providing genuinely personalized coaching \u2014 not generic responses."
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    3,
    "Privacy-first architecture: All data is isolated per user, encrypted at rest, and never shared. The AI is explicitly identified as AI with stated limitations."
  );

  sectionTitle(doc, "Who are your customers?");
  bodyText(
    doc,
    "Adults (25\u201355) experiencing mental health challenges, recovery from addiction, or managing chronic conditions requiring medication adherence. Also: people in early recovery who lack structured daily support, individuals transitioning from intensive therapy to self-directed wellness, and health-conscious users interested in evidence-based self-monitoring."
  );

  sectionTitle(doc, "What is your revenue model?");
  bodyText(
    doc,
    "Subscription: $49.99/year or $79.99 lifetime. Payment via Square (in-app checkout). The lifetime option is designed for early supporters and generates immediate revenue. Annual subscriptions provide recurring revenue."
  );

  sectionTitle(doc, "How will you use the funding?");
  bulletItem(doc, "Complete beta testing and production hardening ($10,000)");
  bulletItem(doc, "User acquisition and marketing ($15,000)");
  bulletItem(
    doc,
    "Wearable device integration \u2014 Apple Health, Fitbit ($15,000)"
  );
  bulletItem(doc, "Operating costs for 6 months ($20,000)");
  bulletItem(doc, "Legal, accounting, and compliance ($5,000)");

  sectionTitle(doc, "What are your sales/marketing plans?");
  numberedItem(
    doc,
    1,
    "Content marketing: Science-backed blog posts on wellness, recovery, and neuroscience (SEO)"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    2,
    "Community partnerships: Recovery centers, wellness practitioners, mental health advocates"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    3,
    "Social media: Twitter/X, LinkedIn (evidence-based wellness content)"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    4,
    "Pitch competitions and accelerator programs (CDL, DMZ, NEXT Canada)"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    5,
    "Referral program: Give a month free for referrals"
  );

  sectionTitle(doc, "What experience do you bring?");
  bodyText(
    doc,
    "The founder has lived experience with recovery and sustained study of cognitive neuroscience and addiction science. Technical skills include full-stack development (TypeScript, React, PostgreSQL, AI integration). The business is built from personal understanding of the problem space combined with the technical ability to build the solution."
  );

  addFooter(doc, 1, 1);
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ============================================================
// DOCUMENT 4: Pitch Deck Outline
// ============================================================
function generatePitchDeck() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(
    path.join(OUTPUT_DIR, "kindred-pitch-deck-outline.pdf")
  );
  doc.pipe(stream);

  addHeader(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a2e")
    .text("Pitch Deck Outline \u2014 12 Slides");
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#666666")
    .text(
      "Use this as a reference when building your deck in Canva, Google Slides, or PowerPoint."
    );
  doc.moveDown(0.8);

  const slides = [
    {
      title: "Slide 1: Title",
      content:
        '"KINDRED ASTERLING"\n"Where neuroscience meets compassion"\nYour name + Edmonton, AB\nkindred-asterling-ai-coaching.com',
    },
    {
      title: "Slide 2: The Problem",
      content:
        "\u2022 1 in 5 Canadians experience mental illness annually\n\u2022 Therapy costs $150\u2013250/session; wait times 3\u20136 months\n\u2022 Most people have no structured daily support between appointments\n\u2022 Existing apps are generic, not personalized, not evidence-based",
    },
    {
      title: "Slide 3: The Solution",
      content:
        "\u2022 Kindred: AI wellness companion grounded in neuroscience\n\u2022 Daily rhythm: Begin, Throughout, Close\n\u2022 Personalized AI coaching that reads your data\n\u2022 Medication tracking, habit building, body scans, reflections\n\u2022 Voice input/output for accessibility",
    },
    {
      title: "Slide 4: How It Works",
      content:
        "Three-card visual:\n\u2022 Morning Check-in\n\u2022 AI Conversation\n\u2022 Evening Reflection\n\nShow screenshots of each.\n\"The brain consolidates what it rehearses.\"",
    },
    {
      title: "Slide 5: The Science",
      content:
        "\u2022 Four research pillars: Lewis, McCauley, Grisel, ACE Framework\n\u2022 DBT and CBT techniques woven into coaching\n\u2022 \"Anchored in peer-reviewed science\"\n\u2022 Reference your science page (kindred-asterling-ai-coaching.com/science)",
    },
    {
      title: "Slide 6: Product Demo",
      content:
        "3\u20134 polished screenshots:\n\u2022 Dashboard\n\u2022 Chat with Kindred\n\u2022 Medication Tracker\n\u2022 Body Scan\n\n\"Feature-complete, deployed, ready for beta.\"",
    },
    {
      title: "Slide 7: Market Opportunity",
      content:
        "\u2022 $20B+ digital mental health market, growing 20%+ annually\n\u2022 Canada: $51B/year mental health costs\n\u2022 Underserved: no neuroscience-grounded AI wellness companion exists",
    },
    {
      title: "Slide 8: Business Model",
      content:
        "\u2022 $49.99/year or $79.99 lifetime\n\u2022 Subscription paywall via Square\n\u2022 Low barrier, high retention",
    },
    {
      title: "Slide 9: Traction",
      content:
        "\u2022 Feature-complete (12+ integrated features)\n\u2022 Deployed on Coolify (self-hosted)\n\u2022 Science-backed marketing site with SEO\n\u2022 Square payment processing live\n\u2022 [Add user metrics when available]",
    },
    {
      title: "Slide 10: Roadmap",
      content:
        "\u2022 Q3 2026: Beta launch, first 100 users\n\u2022 Q4 2026: Wearable integration (Apple Health, Fitbit)\n\u2022 Q1 2027: AI insights and pattern analysis\n\u2022 Q2 2027: Therapist/coach portal\n\u2022 Q3 2027: Multi-language, international expansion",
    },
    {
      title: "Slide 11: Team",
      content:
        "\u2022 Solo founder, Edmonton AB\n\u2022 Lived experience with recovery\n\u2022 Sustained study of cognitive neuroscience\n\u2022 Full-stack technical capability\n\u2022 \"Built from lived experience and curiosity about the brain\"",
    },
    {
      title: "Slide 12: The Ask",
      content:
        "\u2022 $50K\u2013$150K for beta launch + first 500 users\n\u2022 Open to: grants, accelerators, angel investment\n\u2022 Contact:\n   kindred-asterling-ai-coaching.com\n   kindredaicoaching@gmail.com\n   587-594-6872",
    },
  ];

  slides.forEach((slide, i) => {
    if (i > 0) doc.moveDown(0.8);
    sectionTitle(doc, slide.title);
    bodyText(doc, slide.content);
  });

  addFooter(doc, 1, 1);
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ============================================================
// DOCUMENT 5: Community Futures Script
// ============================================================
function generateCommunityFutures() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(
    path.join(OUTPUT_DIR, "kindred-community-futures-script.pdf")
  );
  doc.pipe(stream);

  addHeader(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a2e")
    .text("Community Futures Edmonton \u2014 Call Script");
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#666666")
    .text("Phone: 780-422-5776");
  doc.moveDown(0.8);

  sectionTitle(doc, "Opening (30 seconds)");
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#333333")
    .text(
      '"Hi, my name is [Your Name]. I\u2019m an entrepreneur in Edmonton. I\u2019ve built an AI wellness companion app \u2014 it\u2019s a subscription platform that helps people with mental health and recovery through daily check-ins, AI coaching, and medication tracking. The app is feature-complete and deployed on Coolify. I\u2019m calling because I need guidance on a couple of things and I heard Community Futures helps entrepreneurs like me."',
      { lineGap: 3 }
    );

  sectionTitle(doc, "What You Need (1\u20132 minutes)");
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#333333")
    .text(
      '"I\u2019m at a point where the product is ready but I\u2019m hitting two bottlenecks:\n\nFirst, I need to incorporate federally to access NRC IRAP and SR&ED tax credits. The incorporation fee is $200. I know that\u2019s a small amount but right now it\u2019s a real constraint for me. Do you have any micro-loans or grants that could help with this?\n\nSecond, once I incorporate, I\u2019ll be eligible for NRC IRAP which covers 60\u201380% of R&D costs, and SR&ED which gives back 35\u201343% of development costs as a tax refund. I want to make sure I\u2019m positioned correctly for those applications. Can you help me with business planning or connecting me to someone who\u2019s been through IRAP?"',
      { lineGap: 3 }
    );

  sectionTitle(doc, "Your Elevator Pitch (30 seconds)");
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#333333")
    .text(
      '"It\u2019s called Kindred Asterling. It\u2019s an AI wellness companion grounded in cognitive neuroscience \u2014 not a generic chatbot. Users do daily check-ins, talk to an AI coach called Kindred that knows their medications and habits, track their progress, and get SMS/email reminders. It\u2019s $50 a year or $80 for lifetime access. Think of it as a structured daily support system for people in recovery or managing mental health challenges."',
      { lineGap: 3 }
    );

  sectionTitle(doc, "Questions to Ask");
  numberedItem(
    doc,
    1,
    "Do you have any micro-loans or grants that cover incorporation costs for new businesses?"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    2,
    "Can you connect me with a mentor who\u2019s been through the NRC IRAP process?"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    3,
    "I\u2019m applying to Futurpreneur for their $75K loan + mentorship program. Can you help me prepare a business plan for that application?"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    4,
    "Are there any local pitch competitions or demo days you\u2019d recommend?"
  );
  doc.moveDown(0.2);
  numberedItem(
    doc,
    5,
    "Do you know any angel investors in Edmonton who focus on health tech or AI?"
  );

  sectionTitle(doc, "What to Bring / Have Ready");
  bulletItem(doc, "Your one-page summary (kindred-one-pager.pdf)");
  bulletItem(
    doc,
    "Your Coolify URL so they can see the live app (kindred-asterling-ai-coaching.com)"
  );
  bulletItem(doc, "A brief list of your expenses so far (~$700 CAD)");
  bulletItem(
    doc,
    "Your BN9 number and GST/HST registration details"
  );
  bulletItem(
    doc,
    "A simple cash flow projection (even if it\u2019s just $0 revenue currently)"
  );

  sectionTitle(doc, "Your Contact Info to Share");
  bulletItem(doc, "Website: kindred-asterling-ai-coaching.com");
  bulletItem(doc, "Email: kindredaicoaching@gmail.com");
  bulletItem(doc, "Phone: 587-594-6872");

  addFooter(doc, 1, 1);
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ============================================================
// Run all generators
// ============================================================
async function main() {
  console.log("Generating PDFs...\n");

  await generateOnePager();
  console.log("  [1/5] kindred-one-pager.pdf");

  await generateIRAP();
  console.log("  [2/5] kindred-irap-narrative.pdf");

  await generateFuturpreneur();
  console.log("  [3/5] kindred-futurpreneur-answers.pdf");

  await generatePitchDeck();
  console.log("  [4/5] kindred-pitch-deck-outline.pdf");

  await generateCommunityFutures();
  console.log("  [5/5] kindred-community-futures-script.pdf");

  console.log(`\nAll 5 PDFs saved to: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import type { ReactNode } from "react";

type LegalBlock =
  | { type: "paragraph"; content: ReactNode }
  | { type: "list"; items: ReactNode[]; ordered?: boolean }
  | { type: "subheading"; content: ReactNode }
  | { type: "callout"; content: ReactNode };

type LegalSection =
  | { heading: string; blocks: LegalBlock[] }
  | { heading: string; content: ReactNode | LegalBlock };

interface LegalPageProps {
  title: string;
  summary: string;
  governingLaw?: string;
  pdfHref?: string;
  sections: LegalSection[];
}

const confirmationClass =
  "rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100";

function Confirmation({ children }: { children: ReactNode }) {
  return (
    <div className={confirmationClass}>
      <strong>Founder/legal confirmation required:</strong> {children}
    </div>
  );
}

const paragraph = (content: ReactNode): LegalBlock => ({
  type: "paragraph",
  content,
});

const list = (items: ReactNode[], ordered = false): LegalBlock => ({
  type: "list",
  items,
  ordered,
});

const subheading = (content: ReactNode): LegalBlock => ({
  type: "subheading",
  content,
});

const callout = (content: ReactNode): LegalBlock => ({
  type: "callout",
  content,
});

function renderBlock(block: LegalBlock, index: number) {
  if (block.type === "paragraph") {
    return <p key={index}>{block.content}</p>;
  }

  if (block.type === "subheading") {
    return (
      <h3 className="font-semibold text-foreground" key={index}>
        {block.content}
      </h3>
    );
  }

  if (block.type === "callout") {
    return (
      <div
        className="whitespace-pre-line rounded-xl border border-border bg-card p-5 text-foreground"
        key={index}
      >
        {block.content}
      </div>
    );
  }

  const ListTag = block.ordered ? "ol" : "ul";
  return (
    <ListTag
      className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5`}
      key={index}
    >
      {block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{item}</li>
      ))}
    </ListTag>
  );
}

function isLegalBlock(content: ReactNode | LegalBlock): content is LegalBlock {
  if (typeof content !== "object" || content === null || !("type" in content)) {
    return false;
  }

  const candidate = content as Partial<LegalBlock>;
  return (
    candidate.type === "paragraph" ||
    candidate.type === "list" ||
    candidate.type === "subheading" ||
    candidate.type === "callout"
  );
}

function renderLegacyContent(content: ReactNode | LegalBlock): ReactNode {
  if (isLegalBlock(content)) {
    return renderBlock(content, 0);
  }

  return content;
}

function LegalPage({
  title,
  summary,
  governingLaw,
  pdfHref,
  sections,
}: LegalPageProps) {
  const metadata = [
    ["Version", "1.0 (Final Review Draft)"],
    ["Date", "August 24, 2026"],
    ...(governingLaw ? [["Governing law", governingLaw]] : []),
    ["Sole proprietor", "Landon Syroid d/b/a Kindred Asterling AI Coaching"],
    ["Status", "Subject to Final Legal Counsel Approval"],
  ];

  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Working draft — not legal advice
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          {summary}
        </p>

        <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {metadata.map(([label, value]) => (
            <div className="bg-card px-4 py-3" key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Draft - for final legal review and execution - not for distribution
        </div>

        {pdfHref ? (
          <a
            className="mt-5 inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            href={pdfHref}
            download
          >
            Download the supplied PDF
          </a>
        ) : null}
      </header>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground">
              {"blocks" in section
                ? section.blocks.map(renderBlock)
                : renderLegacyContent(section.content)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

const privacySections: LegalSection[] = [
  {
    heading: "1. Organization & Privacy Officer",
    blocks: [
      paragraph(
        'Kindred Asterling AI Coaching ("Kindred", "we", "us", or "our") is an Alberta sole proprietorship owned and operated by Landon Syroid, located in Edmonton, Alberta, Canada.',
      ),
      paragraph(
        "We are dedicated to safeguarding your personal privacy and adhering strictly to the Alberta Personal Information Protection Act (PIPA, SA 2003, c P-6.5), the Canadian federal Personal Information Protection and Electronic Documents Act (PIPEDA, SC 2000, c 5), and international data protection standards.",
      ),
      subheading("Designated Privacy Officer Contact:"),
      list([
        "Privacy Inquiries & Access Requests: kindredaicoach@gmail.com",
        "Customer & Account Support: kindred_support@kindred-asterling-ai-coaching.com",
        "Mailing Address: 202 - 10249 119 ST NW, Edmonton, AB T5K 2Y6, Canada",
      ]),
    ],
  },
  {
    heading: "2. Personal Information We Collect",
    blocks: [
      paragraph(
        "We collect and process only the personal information strictly necessary to provide and operate the Service:",
      ),
      list(
        [
          "Account & Authentication Data: Email address, user identification tokens, account verification status, and name provided through our authentication partner, Clerk.",
          "Wellness, Reflection & Coaching Data: Self-submitted morning check-ins, evening reflections, mood scores, body scan notes, habit records, medication logs, personal goals, and chat interactions with the coaching AI.",
          "Calendar Integration Metadata (Optional): When you choose to connect Google Calendar, we retrieve read-only upcoming schedule data to calculate a non-identifying, title-free schedule-density metric (e.g., light, moderate, heavy schedule load).",
          "Subscription & Transaction Data: Payment references, plan tiers (Yearly or Lifetime Access), and transaction IDs processed securely through Helcim. We do not store or process raw credit card numbers.",
          "Operational & Security Telemetry: Server access logs, security events, quota tracking, and application error logs.",
        ],
        true,
      ),
    ],
  },
  {
    heading: "3. Purposes for Processing Personal Information",
    blocks: [
      paragraph(
        "We collect and process your personal information strictly for the following purposes:",
      ),
      list([
        "Delivering automated coaching dialogue, reflection prompts, and habit summaries.",
        "Personalizing conversational coaching pacing using interaction-scoped context minimization.",
        "Processing subscription payments, managing accounts, and preventing abuse or security breaches.",
        "Complying with Canadian accounting, tax, and statutory requirements.",
      ]),
      paragraph(
        "AI Training Exclusion: We do not sell your personal information. Personal wellness data, reflection logs, and coaching interactions are never used to train public or foundational machine learning models.",
      ),
    ],
  },
  {
    heading: "4. Third-Party Service Providers & Cross-Border Data Transfers",
    blocks: [
      paragraph(
        "To deliver our secure cloud platform, personal information may be transferred to and processed by vetted third-party service providers. In accordance with Section 13.1 of Alberta PIPA, please note that personal data transferred across provincial or international borders may be accessible to foreign regulatory or law enforcement authorities under lawful orders in the jurisdictions where those facilities are located:",
      ),
      list([
        "AI Inference Engine: Amazon Web Services (AWS) Bedrock (USA / Canada) - zero-retention enterprise inference for model execution.",
        "Cloud Hosting & Infrastructure: Contabo GmbH (Munich, Germany) - secure VPS infrastructure and database management.",
        "Authentication & Identity: Clerk (USA / Global) - secure session management.",
        "Payment Processing: Helcim (Calgary, AB, Canada) - PCI-DSS compliant checkout and subscription billing.",
        "Communications: Resend (transactional email), Twilio (SMS reminders, where enabled), and ElevenLabs (voice synthesis, where enabled).",
      ]),
    ],
  },
  {
    heading: "5. Google API Services User Data Policy & Limited Use",
    blocks: [
      paragraph(
        "Kindred's use and transfer to any other app of information received from Google APIs adheres strictly to the Google API Services User Data Policy, including the Limited Use requirements:",
      ),
      list([
        "Scope Minimization: We request read-only access strictly to upcoming calendar metadata.",
        "Title-Free Processing: Raw event titles, meeting descriptions, participant emails, and sensitive event details are not injected into the AI context. Only an aggregated schedule-density signal is utilized.",
        "No Secondary Marketing or AI Training: Google user data is never sold, transferred to data brokers, used for advertising, or used to train general-purpose AI models.",
        "Revocation: You may disconnect Google Calendar and revoke OAuth permissions at any time within your account settings, triggering immediate token deletion from our databases.",
      ]),
    ],
  },
  {
    heading: "6. Retention Schedules, Access & Deletion Rights",
    blocks: [
      subheading("A. Retention Periods"),
      list([
        "Active Account & Coaching Records: Retained for the duration of your active account lifecycle.",
        "Server Backups: Automated encrypted backups are retained on a rolling 35-day cycle.",
        "Administrative & Security Logs: Retained for up to 12 months for security auditing.",
        "Billing & Transaction Records: Retained for up to 7 years to satisfy Canada Revenue Agency (CRA) tax obligations.",
      ]),
      subheading("B. Individual Rights Under Alberta PIPA"),
      paragraph(
        "Under Alberta PIPA and Canadian privacy legislation, you have the right to:",
      ),
      list([
        "Access and inspect the personal information we hold about you.",
        "Request corrections to inaccurate or incomplete personal records.",
        "Request account deletion and complete erasure of your coaching history.",
        "Withdraw consent for optional processing (e.g., calendar integration, marketing emails).",
      ]),
      paragraph(
        "To exercise any of these rights, submit a written request to our Privacy Officer at kindredaicoach@gmail.com. We respond to verified requests within thirty (30) days in compliance with statutory timelines.",
      ),
    ],
  },
  {
    heading: "7. Security Measures & Breach Notification",
    blocks: [
      paragraph(
        "We employ industry-standard administrative, physical, and technical safeguards, including TLS 1.3 encryption in transit, AES-256 encryption at rest for OAuth tokens, role-based access restrictions, and automated vulnerability monitoring.",
      ),
      paragraph(
        "In the event of a security incident involving personal information that poses a real risk of significant harm, we will promptly notify affected individuals and the Office of the Information and Privacy Commissioner of Alberta (OIPC) in compliance with Section 34.1 of Alberta PIPA.",
      ),
    ],
  },
];

const termsSections: LegalSection[] = [
  {
    heading: "1. Agreement to Terms & Eligibility",
    blocks: [
      paragraph(
        'These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and Landon Syroid, operating as Kindred Asterling AI Coaching ("Kindred", "we", "us", or "our"), governing your access to and use of the Kindred web application and associated services (the "Service").',
      ),
      paragraph(
        "By registering an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must not access or use the Service.",
      ),
      paragraph(
        "Age Requirement (Adults 18+ Only): You must be at least eighteen (18) years of age to create an account or use the Service. By accessing the Service, you represent and warrant that you are at least 18 years old. Minors are strictly prohibited from creating accounts or using the Service.",
      ),
    ],
  },
  {
    heading: "2. Service Description & Non-Clinical Coaching",
    blocks: [
      paragraph(
        "Kindred provides automated, artificial intelligence-assisted personal coaching, daily reflection journaling, habit tracking, and progress visualization tools.",
      ),
      callout(
        "IMPORTANT NOTICE - NO PROFESSIONAL ADVICE: THE SERVICE IS AN INFORMATIONAL WELLNESS AND PERSONAL DEVELOPMENT TOOL ONLY. KINDRED IS NOT A HEALTHCARE PROVIDER, MENTAL HEALTH CLINIC, PSYCHIATRIC FACILITY, OR FINANCIAL ADVISOR. CONTENT AND OUTPUTS GENERATED BY THE SERVICE DO NOT CONSTITUTE MEDICAL, PSYCHOLOGICAL, LEGAL, OR FINANCIAL ADVICE, AND ARE NOT A SUBSTITUTE FOR EVALUATION BY A LICENSED PROFESSIONAL.",
      ),
    ],
  },
  {
    heading: "3. Subscriptions, Pricing, Lifetime Access & Refunds",
    blocks: [
      subheading("A. Pricing & Billing"),
      list([
        "Payment Processing: All subscription fees (e.g., $49.99 CAD/year) and one-time fees (e.g., $79.99 CAD Lifetime Access) are processed securely through Helcim. All fees are denominated in Canadian Dollars (CAD) unless otherwise indicated, plus applicable sales taxes (e.g., GST).",
        "Annual Subscriptions: Annual plans renew automatically at the end of each billing cycle unless cancelled prior to the renewal date.",
      ]),
      subheading("B. 30-Day Cancellation & Refund Policy"),
      paragraph(
        "You may cancel your initial subscription purchase within thirty (30) calendar days of purchase to receive a full refund. Refund requests should be submitted to kindred_support@kindred-asterling-ai-coaching.com.",
      ),
      subheading('C. Definition of "Lifetime Access"'),
      paragraph(
        '"Lifetime Access" refers to access to the core features of the Kindred platform for the commercial operational lifespan of the software service. It does not guarantee perpetual operation in perpetuity. In the event of planned service discontinuation or platform retirement, Kindred will provide registered Lifetime Access holders with at least sixty (60) calendar days\' advance written notice via email.',
      ),
    ],
  },
  {
    heading: "4. Acceptable Use Policy",
    blocks: [
      paragraph("You agree not to:"),
      list([
        "Use the Service for any unlawful, harassing, defamatory, fraudulent, or harmful purpose.",
        "Reverse-engineer, decompile, crawl, or attempt to extract source code or underlying AI models.",
        "Interfere with or disrupt the integrity, security, or performance of our cloud infrastructure.",
        "Input confidential or personal health data belonging to third parties without lawful authorization.",
        "Rely upon AI-generated outputs for emergency, medical, psychiatric, or life-critical decisions.",
      ]),
    ],
  },
  {
    heading: "5. Intellectual Property Rights",
    blocks: [
      list([
        "Platform Ownership: Kindred, its software, branding, user interfaces, documentation, and algorithms are the proprietary property of Landon Syroid and are protected by Canadian and international intellectual property laws.",
        "User Inputs & Data: You retain full ownership of the text, journal entries, and personal data you input into the Service. You grant Kindred a limited, non-exclusive, royalty-free license solely to host, process, and display such data as technically necessary to operate and deliver the Service.",
      ]),
    ],
  },
  {
    heading: "6. Disclaimer of Warranties",
    blocks: [
      callout(
        'TO THE MAXIMUM EXTENT PERMITTED UNDER THE LAWS OF THE PROVINCE OF ALBERTA AND APPLICABLE CANADIAN LAW, THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. KINDRED EXPRESSLY DISCLAIMS ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR ACCURATE.',
      ),
    ],
  },
  {
    heading: "7. Limitation of Liability",
    blocks: [
      callout(
        "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL KINDRED, ITS PROPRIETOR, CONTRACTORS, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR PERSONAL INJURY) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.",
      ),
      paragraph(
        "OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF:",
      ),
      list(
        [
          "THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO KINDRED IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY; OR",
          "FIFTY CANADIAN DOLLARS ($50.00 CAD).",
        ],
        true,
      ),
      paragraph(
        "NOTHING IN THESE TERMS EXCLUDES OR LIMITS ANY MANDATORY CONSUMER RIGHTS THAT CANNOT BE CONTRACTUALLY WAIVED UNDER THE ALBERTA CONSUMER PROTECTION ACT (RSA 2000, c C-26.3).",
      ),
    ],
  },
  {
    heading: "8. Dispute Resolution & Governing Law",
    blocks: [
      subheading("A. Mandatory Informal Resolution"),
      paragraph(
        "Before initiating any formal legal claim, you agree to contact us at kindred_support@kindred-asterling-ai-coaching.com and attempt in good faith to resolve the dispute informally for at least thirty (30) days.",
      ),
      subheading("B. Governing Law & Forum Selection"),
      paragraph(
        "These Terms, your use of the Service, and any disputes arising hereunder shall be governed by and construed in accordance with the laws of the Province of Alberta and the federal laws of Canada applicable therein, without regard to conflict of law principles.",
      ),
      paragraph(
        "Subject to mandatory consumer protection laws, you irrevocably submit to the exclusive personal and subject-matter jurisdiction of the Courts of the Judicial District of Edmonton in the Province of Alberta, Canada.",
      ),
    ],
  },
  {
    heading: "9. Contact Information",
    blocks: [
      paragraph("For inquiries regarding these Terms:"),
      list([
        "Legal & Support Email: kindred_support@kindred-asterling-ai-coaching.com",
        "Privacy Officer Email: kindredaicoach@gmail.com",
        "Mailing Address: 202 - 10249 119 ST NW, Edmonton, AB T5K 2Y6, Canada",
      ]),
    ],
  },
];

const healthSections: LegalSection[] = [
  {
    heading: "1. Non-Medical and Non-Clinical Nature of the Service",
    blocks: [
      paragraph(
        'Kindred Asterling AI Coaching ("Kindred", "we", "us", or "our"), operated by Landon Syroid in Edmonton, Alberta, Canada, is an automated informational wellness coaching and personal reflection platform.',
      ),
      callout(
        "KINDRED IS NOT A LICENSED HEALTHCARE PROVIDER, MEDICAL CLINIC, CRISIS INTERVENTION CENTER, OR PSYCHIATRIC FACILITY.",
      ),
      list([
        "No Medical or Therapeutic Advice: All content, AI dialogue, morning/evening reflection prompts, body scan logs, calendar load signals, and generated progress summaries are provided exclusively for personal informational and educational purposes.",
        "No Clinical Diagnosis or Treatment: Kindred does not diagnose, treat, prevent, mitigate, or cure any physical, mental, psychiatric, or psychological illness, condition, or disorder. The Service is not a substitute for clinical judgment, medical examinations, or psychotherapy provided by a licensed physician, psychiatrist, registered psychologist, or healthcare professional.",
      ]),
    ],
  },
  {
    heading: "2. Medication & Habit Tracking Boundaries",
    blocks: [
      paragraph(
        "Medication tracking, schedule reminders, and habit check-in features within Kindred function solely as a self-directed personal organizational log.",
      ),
      list([
        "No Pharmaceutical Evaluation: Kindred does not prescribe, modify, evaluate, or adjust medications, dosages, or schedules.",
        "No Drug Interaction or Safety Checks: Kindred does not evaluate contraindications, drug interactions, side effects, or clinical efficacy.",
        "Mandatory Professional Consultation: Any decision to initiate, alter, taper, or discontinue prescription medications, over-the-counter drugs, or dietary supplements must be made under the direct supervision of a licensed physician or pharmacist.",
      ]),
    ],
  },
  {
    heading: "3. Emergency & Crisis Protocols",
    blocks: [
      paragraph(
        "Kindred is an automated system and is not monitored for emergencies, acute mental health crises, or medical urgency.",
      ),
      paragraph(
        "If you need urgent help, contact emergency services in your location or go to the nearest emergency department. In Canada and the United States, call 911 for immediate danger; crisis support is also available by calling or texting 988. In other jurisdictions, contact the local emergency service or national crisis support line.",
      ),
    ],
  },
  {
    heading: "4. Limitation on Outcomes & User Responsibility",
    blocks: [
      paragraph(
        "Kindred makes no guarantees, representations, or warranties regarding specific personal, psychological, educational, career, or physical outcomes resulting from using the platform.",
      ),
      paragraph(
        "Users maintain sole responsibility for verifying all information and applying independent judgment before acting on any coaching output.",
      ),
    ],
  },
  {
    heading: "5. Age Restriction (Adults 18+ Only)",
    blocks: [
      paragraph(
        "The Service is strictly designed and offered to individuals who are at least eighteen (18) years of age. Kindred is not directed to or intended for use by minors.",
      ),
    ],
  },
];

const transparencySections: LegalSection[] = [
  {
    heading: "1. Scope & Purpose",
    blocks: [
      paragraph(
        'Kindred Asterling AI Coaching ("Kindred", "we", "us", or "our"), operated by Landon Syroid as an Alberta sole proprietorship based in Edmonton, Alberta, Canada, integrates generative artificial intelligence to deliver conversational coaching, guided self-reflections, habit tracking, and structured personal summaries.',
      ),
      paragraph(
        "This Disclosure outlines where and how artificial intelligence operates within the Kindred platform, the technical and contextual boundaries enforced, and our strict adherence to Canadian privacy principles and consumer transparency standards.",
      ),
    ],
  },
  {
    heading: "2. Where AI Is Used",
    blocks: [
      paragraph(
        "Artificial intelligence is utilized within the Kindred platform strictly for the following functions:",
      ),
      list([
        "Conversational Coaching Dialogue: Generating interactive coaching prompts, reflective inquiries, and conversational responses based on user-initiated messages.",
        "Self-Assessment Summaries: Synthesizing user-submitted morning check-ins, evening reflections, body scans, and goal tracking into periodic progress overviews.",
        "Contextual Schedule Density Signals: Calculating high-level calendar density indicators (e.g., light, moderate, high load) when the optional Google Calendar integration is connected, enabling the AI to tailor coaching pacing without reading raw event descriptions or personal meeting details.",
      ]),
    ],
  },
  {
    heading: "3. Context Minimization & Privacy Architecture",
    blocks: [
      paragraph(
        "Kindred enforces strict technical constraints to ensure user data minimization:",
      ),
      list([
        "Interaction-Scoped Context: The context assembly engine retrieves only data categories relevant to the immediate user prompt rather than injecting complete historical archives into each AI prompt.",
        "User-Isolated Tenancy: All retrieval operations are strictly bounded to the authenticated user's account and governed by character and item limits.",
        "Zero Model Training Commitment: Personal user reflections, journal logs, habit metrics, and chat conversations are processed via dedicated enterprise inference (AWS Bedrock) and are never used to train, retrain, fine-tune, or improve public or proprietary foundational AI models.",
      ]),
    ],
  },
  {
    heading: "4. Inherent Limitations & Operational Boundaries",
    blocks: [
      paragraph(
        "Users acknowledge and agree to the following inherent limitations of automated AI systems:",
      ),
      list([
        "Probabilistic Output: Generative AI produces probabilistic text. Outputs may occasionally be incomplete, inaccurate, or inconsistent with prior outputs.",
        "No Human Knowledge or Professional Credentials: Kindred is an automated software application. It possesses no human emotion, sentience, independent real-world knowledge, or professional certifications.",
        "Non-Consequential & Non-Clinical Utility: Kindred outputs are intended solely for personal reflection and organizational wellness. They must not be relied upon as the sole basis for consequential personal, legal, financial, or medical decisions.",
      ]),
    ],
  },
  {
    heading: "5. Technical Infrastructure & Providers",
    blocks: [
      list([
        "Production AI Inference: Enterprise inference is executed via Amazon Web Services (AWS) Bedrock in designated secure cloud environments under zero-data-retention terms for model training.",
        "Supplementary Infrastructure: Local experimental or fallback engines are isolated to development environments and are not deployed in production without explicit disclosure and security validation.",
      ]),
    ],
  },
  {
    heading: "6. Canadian Privacy & Generative AI Standards",
    blocks: [
      paragraph(
        "This disclosure is structured to align with the Joint Principles for Generative AI Technologies issued by Canadian Federal, Provincial, and Territorial Privacy Authorities (including the Office of the Privacy Commissioner of Canada - OPC and the Office of the Information and Privacy Commissioner of Alberta - OIPC), upholding the principles of:",
      ),
      list([
        "Meaningful Consent & Transparency: Clear notification prior to user interaction with automated systems.",
        "Appropriate & Proportional Purpose: Restricting AI processing strictly to legitimate wellness coaching features.",
        "Individual Access & Rectification: Enabling users to inspect, export, and delete AI-generated summaries and chat histories upon request.",
      ]),
    ],
  },
];

const cookieSections: LegalSection[] = [
  {
    heading: "1. Scope & Commitment",
    blocks: [
      paragraph(
        'Kindred Asterling AI Coaching ("Kindred", "we", "us", or "our"), operated by Landon Syroid in Edmonton, Alberta, Canada, is committed to transparent and minimal data collection. This Notice explains the essential browser storage technologies, security cookies, and diagnostic tools used on the Kindred web application.',
      ),
      paragraph(
        "We do not engage in third-party behavioral advertising, cross-site tracking, or data brokering.",
      ),
    ],
  },
  {
    heading: "2. Categories of Technologies We Use",
    blocks: [
      subheading("A. Strictly Necessary & Authentication Technologies"),
      paragraph(
        "These technologies are essential for the operation, integrity, and security of the platform. The platform cannot function securely without them.",
      ),
      list([
        "Clerk Authentication: Session cookies and local storage tokens utilized to maintain authenticated user sessions, verify identity, and defend against cross-site request forgery (CSRF).",
        "Hosting & Infrastructure Security: Technical routing, SSL termination, and DDoS protection headers set by our hosting and edge infrastructure (Contabo GmbH / Cloudflare).",
      ]),
      subheading("B. Functional & Interface Preference Storage"),
      list([
        "Browser LocalStorage: Stores client-side visual preferences, such as light/dark interface mode or user-selected view toggles, directly on your local device.",
      ]),
      subheading("C. Technical Diagnostics & Error Monitoring"),
      list([
        "Application and Hosting Logs: Technical server and infrastructure logs may be used to operate, secure, and troubleshoot the service.",
        "No Third-Party Browser Diagnostics: Kindred does not load a third-party browser analytics or error-reporting SDK.",
      ]),
    ],
  },
  {
    heading: "3. Explicit Exclusion of Advertising Trackers",
    blocks: [
      list([
        "No Advertising Networks: We do not deploy Google Analytics, Meta (Facebook) Pixels, TikTok pixels, or advertising tracking beacons.",
        "No Third-Party Social Widgets: Outbound links to external platforms in our site footer are standard hyperlinks and do not execute third-party tracking scripts or tracking beacons.",
      ]),
    ],
  },
  {
    heading: "4. User Controls & Managing Storage",
    blocks: [
      paragraph(
        "You can adjust your cookie and storage preferences at any time through your web browser settings:",
      ),
      list([
        "Disabling Storage: You can configure your browser to reject cookies or purge local storage caches.",
        "Impact on Core Services: Please note that disabling strictly necessary cookies and local storage will prevent you from signing in or maintaining an active coaching session.",
      ]),
    ],
  },
  {
    heading: "5. Inquiries",
    blocks: [
      paragraph(
        "For questions regarding our use of cookies and storage technologies, contact our Privacy Officer:",
      ),
      list([
        "Email: kindredaicoach@gmail.com",
        "Support: kindred_support@kindred-asterling-ai-coaching.com",
        "Mailing Address: 202 - 10249 119 ST NW, Edmonton, AB T5K 2Y6, Canada",
      ]),
    ],
  },
];

const marketingSections: LegalSection[] = [
  {
    heading: "1. Statutory Background & Standards",
    blocks: [
      paragraph(
        "Under Canada's Anti-Spam Legislation (CASL, SC 2010, c 23, s 10), the Canadian Radio-television and Telecommunications Commission (CRTC) regulations, and Innovation, Science and Economic Development Canada (ISED) guidelines, sending Commercial Electronic Messages (CEMs) requires:",
      ),
      list(
        [
          "Express, opt-in consent obtained prior to sending.",
          "Complete sender identification including physical mailing address and electronic contact.",
          "A functional, no-cost unsubscribe mechanism operational for at least 60 days post-transmission and executed without delay within 10 business days.",
        ],
        true,
      ),
    ],
  },
  {
    heading: "2. Recommended Front-End Opt-In UI Language",
    blocks: [
      paragraph(
        "To be implemented on registration and settings forms as an unchecked by default checkbox:",
      ),
      callout(
        "[ ] Yes, I would like to receive product announcements, coaching insights, and special promotional offers from Kindred Asterling AI Coaching by email. You may withdraw your consent and unsubscribe at any time using the link in any promotional email. Sender: Landon Syroid, operating as Kindred Asterling AI Coaching, 202 - 10249 119 ST NW, Edmonton, AB T5K 2Y6, Canada. Contact: kindred_support@kindred-asterling-ai-coaching.com.",
      ),
    ],
  },
  {
    heading: "3. Mandatory Email Footer Template",
    blocks: [
      paragraph(
        "All promotional and marketing emails dispatched by or on behalf of Kindred must include the following footer block:",
      ),
      callout(
        "You received this email because you opted in to receive news and offers from Kindred Asterling AI Coaching.\n\nSender Identification:\nLandon Syroid d/b/a Kindred Asterling AI Coaching\n202 - 10249 119 ST NW, Edmonton, AB T5K 2Y6, Canada\nSupport Email: kindred_support@kindred-asterling-ai-coaching.com\nTo stop receiving promotional emails, click here to unsubscribe: [Unsubscribe Link]\nUnsubscribe requests are processed immediately and within 10 business days at no cost.",
      ),
    ],
  },
  {
    heading: "4. Technical Record-Keeping & Proof of Consent",
    blocks: [
      paragraph(
        "To satisfy CASL evidentiary requirements, the database must capture an immutable audit log for every consent event:",
      ),
      list([
        "Identifier: Verified user email address and account ID.",
        "Timestamp: ISO 8601 UTC timestamp of affirmative opt-in.",
        "Source Form & URL: Registration screen, checkout modal, or profile preference page.",
        "Exact Policy Version: Text and version identifier of the consent clause displayed.",
        "IP Address & User Agent: Network telemetry recorded at the time of submission.",
        "Withdrawal Tracking: Date, time, and method of unsubscribe requests, with automatic suppression across all integrated email delivery services (e.g., Resend).",
      ]),
    ],
  },
  {
    heading: "5. Separation of Transactional vs. Marketing Communications",
    blocks: [
      paragraph(
        "Service-related communications (such as password resets, billing receipts from Helcim, mandatory security alerts, and direct coaching notifications requested by the user) are transactional messages and must not be bundled with promotional opt-ins or suppressed upon marketing unsubscribe.",
      ),
    ],
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This working draft for Kindred Asterling AI reflects the data flows visible in the repository. It must be reconciled with the deployed infrastructure, contracts, business practices, and applicable law before publication."
      sections={[
        {
          heading: "Who is responsible",
          content: (
            <>
              <p>
                Kindred Asterling AI is operated as an Alberta sole
                proprietorship based in Edmonton, Alberta, Canada. Privacy
                questions may be sent to{" "}
                <a
                  className="text-primary underline"
                  href="mailto:kindredaicoach@gmail.com"
                >
                  kindredaicoach@gmail.com
                </a>
                . Customer-support requests may be sent to{" "}
                <a
                  className="text-primary underline"
                  href="mailto:kindred_support@kindred-asterling-ai-coaching.com"
                >
                  kindred_support@kindred-asterling-ai-coaching.com
                </a>
                .
              </p>
              <Confirmation>
                An Alberta trade name is not a separate legal person. Confirm
                the proprietor's contracting identity and privacy-officer
                designation. Before publication, provide a business mailbox or
                registered service address instead of publishing a private
                residential address.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Information Kindred handles",
          content: list([
            "Account and identity information, including identity-provider identifiers, email, verification state, name, and profile details you choose to provide.",
            "Wellness and coaching information, including morning and evening reflections, body scans, habits, medication schedules and logs, goals, chat messages, and generated coaching replies.",
            "Optional integration data, including an encrypted Google Calendar refresh token and read-only upcoming-event information, plus reminder preferences, phone number, and time zone when those features are enabled.",
            "Subscription and transaction references needed to confirm access. Kindred's code delegates checkout and billing management to Helcim rather than storing full payment-card details.",
            "Operational information such as request logs, quota usage, security events, and delivery records. The current safety-event code is designed to emit a non-identifying control event rather than message content.",
          ]),
        },
        {
          heading: "Why it is used",
          content: list([
            "Provide authentication, the coaching conversation, assessments, habit and medication tracking, reports, reminders, calendar context, and account support.",
            "Personalize responses using only context selected as relevant to the current interaction.",
            "Operate subscriptions, prevent abuse, protect accounts, troubleshoot failures, and meet legal obligations.",
            "Send marketing only under a separate, recorded consent where required; service messages and marketing preferences must not be bundled.",
          ]),
        },
        {
          heading: "Service providers and disclosures",
          content: (
            <>
              <p>
                Hosting is provided by Contabo GmbH, Welfenstrasse 22, 81541
                Munich, Germany. Production AI inference is provided through AWS
                Bedrock. The repository also supports Clerk (identity), Helcim
                (payments), Google Calendar (optional read-only access), Twilio
                (SMS), Resend (email), and ElevenLabs (voice features). Data
                should be sent to a provider only when its feature is enabled
                and needed.
              </p>
              <Confirmation>
                Confirm the Contabo server location, database provider and
                storage location, AWS Bedrock model and processing region, which
                optional providers are enabled, provider retention and training
                terms, subprocessors, cross-border transfers, and contractual
                safeguards. Remove providers not used in production.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Google Calendar data",
          content: (
            <>
              <p>
                If a user connects Google Calendar, Kindred requests read-only
                access to upcoming events. It stores an encrypted refresh token
                so the connection can continue, displays upcoming event
                information to the user, and may supply only a title-free
                schedule-density signal to the coaching AI.
              </p>
              <p>
                Kindred's use and transfer of information received from Google
                APIs will comply with the{" "}
                <a
                  className="text-primary underline"
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google API Services User Data Policy
                </a>
                , including its Limited Use requirements. Google Calendar data
                is not sold, used for advertising, or used to train a
                general-purpose AI model.
              </p>
              <Confirmation>
                Match the app's requested OAuth scope to the least-privilege
                scope configured in Google Cloud, and implement and verify a
                calendar disconnect and token-revocation flow before promising
                users they can revoke access inside Kindred.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Consent, choices, retention, and access",
          content: (
            <>
              <p>
                Optional calendar and communication processing should require
                specific, informed, revocable consent. The product already
                exposes account export and deletion routes; production
                procedures must also address correction, consent withdrawal,
                provider-side deletion, legal holds, and verified privacy
                requests.
              </p>
              <p>
                Current internal proposals retain account and wellness data for
                the account lifetime, reminder-delivery records for 90 days,
                backups for 35 days, administrative audit records for one year,
                and billing records for up to seven years when legally required.
                These periods are proposals until business and legal review
                confirms them.
              </p>
              <Confirmation>
                Approve or replace each proposed retention period and set the
                request-verification steps, response timelines, deletion and
                legal-hold exceptions, and any other rules required by law.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Security and Canadian privacy guidance",
          content: (
            <>
              <p>
                The code uses access controls, user-scoped queries, encrypted
                calendar tokens, no-store responses for wellness data, and
                security headers. No system is risk-free. Incident response and
                breach notification procedures must be confirmed before launch.
              </p>
              <p>
                Reference guidance:{" "}
                <a
                  className="text-primary underline"
                  href="https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/"
                  target="_blank"
                  rel="noreferrer"
                >
                  PIPEDA fair information principles
                </a>{" "}
                and{" "}
                <a
                  className="text-primary underline"
                  href="https://www.priv.gc.ca/en/privacy-topics/technology/artificial-intelligence/gd_principles_ai"
                  target="_blank"
                  rel="noreferrer"
                >
                  Canadian privacy regulators' generative-AI principles
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}

export function TermsAndConditions() {
  return (
    <LegalPage
      title="Terms and Conditions"
      summary="These working terms describe the adult-only Kindred Asterling AI service but do not become binding until the proprietor identity, commercial terms, and governing law are confirmed and reviewed by counsel."
      sections={[
        {
          heading: "Agreement and eligibility",
          content: (
            <>
              <p>
                By creating an account or using Kindred, a user would agree to
                these terms and the Privacy Policy. Users must provide accurate
                account information and protect their sign-in credentials. The
                service is intended only for people who are at least 18 years
                old; minors are not permitted to create or use an account.
              </p>
              <Confirmation>
                Confirm the proprietor's contracting identity, effective date,
                supported launch locations, age-gate implementation, and the
                process for accepting updated terms.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "The service",
          content: (
            <p>
              Kindred offers AI-assisted wellness coaching, reflections,
              tracking, reports, reminders, and optional integrations. Features
              may change during the pilot. Kindred does not promise a particular
              personal, health, educational, employment, or financial outcome.
            </p>
          ),
        },
        {
          heading: "Subscriptions and payment",
          content: (
            <>
              <p>
                The interface currently advertises a $49.99 yearly plan and a
                $79.99 one-time “Lifetime Access” plan and delegates checkout to
                Helcim. The currency, applicable taxes, yearly renewal terms,
                failed-payment treatment, and any trial terms must be disclosed
                before purchase.
              </p>
              <p>
                The proposed policy permits cancellation requests within 30 days
                of purchase. Cancellation and refund eligibility are different
                matters, and no refund entitlement is promised here until the
                final refund rules are approved. Mandatory consumer rights
                continue to apply.
              </p>
              <p>
                For this draft, “Lifetime Access” means access for up to 100
                years from purchase, subject to these terms; it does not promise
                that the service will operate indefinitely.
              </p>
              <Confirmation>
                Confirm the currency, taxes, whether the yearly plan
                automatically renews, renewal notices, trial rules, refund
                eligibility and method, service-closure remedy, and applicable
                consumer-law disclosures. Reconcile the 100-year definition with
                public claims such as “forever” and “all future features.”
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          content: list([
            "Do not misuse the service, access another person's data, disrupt systems, evade limits, upload unlawful content, or use outputs to harm or deceive others.",
            "Do not treat AI output as professional advice or use it as the sole basis for consequential decisions.",
            "Users retain responsibility for what they submit and for ensuring they have permission to submit information about anyone else.",
          ]),
        },
        {
          heading: "Intellectual property and feedback",
          content: (
            <>
              <p>
                Kindred's software, branding, and site content remain the
                owner's property. Users retain rights they have in their
                submissions, while granting the limited rights needed to store,
                process, and display them to provide the service.
              </p>
              <Confirmation>
                Confirm ownership/licensing of generated outputs, feedback
                rights, trademark owner, and rules for research or
                product-improvement use. Do not claim training rights that are
                not actually intended and separately consented to.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Availability, suspension, and termination",
          content: (
            <p>
              The service may be interrupted or changed. Access may be suspended
              for security, non-payment, or material misuse. Account deletion
              should follow the published privacy and retention process.
            </p>
          ),
        },
        {
          heading: "Disclaimers and liability",
          content: (
            <>
              <p>
                The service is provided on an “as available” basis to the extent
                permitted by law. Mandatory consumer rights are not excluded.
              </p>
              <Confirmation>
                Counsel must draft enforceable warranty disclaimers, liability
                limits, indemnity language, severability, assignment, and
                notices for the actual business jurisdiction.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Governing law and disputes",
          content: (
            <>
              <p>
                These terms are intended to be governed by the laws of Alberta
                and the applicable federal laws of Canada. Subject to mandatory
                consumer rights, disputes would be brought before the courts of
                Alberta.
              </p>
              <Confirmation>
                Approve the proposed process of first sending a written
                complaint to the support address and allowing 30 days for an
                informal resolution. Counsel must confirm the governing-law,
                venue, and dispute terms for every supported launch location.
              </Confirmation>
            </>
          ),
        },
      ]}
    />
  );
}

export function HealthDisclaimer() {
  return (
    <LegalPage
      title="Health Information Disclaimer"
      summary="Kindred is an informational wellness and coaching tool. It is not a healthcare provider or emergency service."
      sections={[
        {
          heading: "Not medical care",
          content: (
            <p>
              Kindred does not diagnose, treat, cure, or prevent any condition.
              Its assessments, calendar-load signals, summaries, and AI
              responses are not clinical evaluations and are not a substitute
              for a physician, therapist, pharmacist, or other qualified
              professional.
            </p>
          ),
        },
        {
          heading: "Medication information",
          content: (
            <p>
              Medication features are for personal organization and reflection.
              Kindred does not prescribe, recommend dose changes, verify
              interactions, or determine whether a medication is safe. Questions
              about starting, stopping, missing, or changing medication belong
              with a qualified professional or pharmacist.
            </p>
          ),
        },
        {
          heading: "Emergencies and urgent concerns",
          content: (
            <p>
              Kindred is not monitored as an emergency channel. For immediate
              danger or urgent medical concerns, contact local emergency
              services or an appropriate local crisis or health service.
            </p>
          ),
        },
        {
          heading: "No guaranteed outcome",
          content: (
            <p>
              AI and self-reported data can be incomplete or wrong. Users should
              verify important information and use professional judgment before
              acting on any output.
            </p>
          ),
        },
        {
          heading: "Adults only",
          content: (
            <p>
              Kindred Asterling AI is intended only for people who are at least
              18 years old. It is not designed for or offered to minors.
            </p>
          ),
        },
        {
          heading: "Required review",
          content: (
            <Confirmation>
              Confirm clinical-risk review, supported launch locations,
              emergency wording, medication feature boundaries, accessibility,
              and any regulated-health obligations for this adult-only service.
            </Confirmation>
          ),
        },
      ]}
    />
  );
}

export function AIUseDisclosure() {
  return (
    <LegalPage
      title="AI Use Disclosure"
      summary="This page explains where Kindred uses AI, what context may be supplied, and why outputs require judgment."
      sections={[
        {
          heading: "Where AI is used",
          content: (
            <p>
              AI generates coaching-chat replies and may help form summaries or
              contextual guidance. The server can provide recent morning and
              evening assessments, body scans, habit information, medication
              status, profile details, and a title-free calendar-load signal
              when those sources are relevant to the current message.
            </p>
          ),
        },
        {
          heading: "Context minimization",
          content: (
            <p>
              Kindred's context assembler selects source categories using the
              current interaction instead of injecting all stored data into
              every conversation. Retrieval is scoped to the signed-in user and
              bounded by item and character limits.
            </p>
          ),
        },
        {
          heading: "Limitations",
          content: list([
            "AI output is probabilistic and may be inaccurate, incomplete, inconsistent, or inappropriate.",
            "Calendar-load categories describe scheduling density only; they are not diagnoses or psychological conclusions.",
            "Kindred does not have human feelings, professional credentials, or independent knowledge of facts outside the information and tools supplied to it.",
            "Important health, legal, financial, safety, or other consequential information requires a qualified human source.",
          ]),
        },
        {
          heading: "Providers and data use",
          content: (
            <>
              <p>
                Production AI inference is provided through AWS Bedrock. The
                server also supports locally operated Ollama and a configured
                OpenAI-compatible service, but those alternatives should not be
                described as production processors unless actually enabled.
              </p>
              <Confirmation>
                Confirm the AWS Bedrock model and processing region, retention,
                abuse monitoring, training policy, human-review access, and
                opt-out or consent choices. Confirm whether any alternative AI
                provider is enabled in production.
              </Confirmation>
            </>
          ),
        },
        {
          heading: "Canadian privacy guidance",
          content: (
            <p>
              The disclosure should be reviewed against the{" "}
              <a
                className="text-primary underline"
                href="https://www.priv.gc.ca/en/privacy-topics/technology/artificial-intelligence/gd_principles_ai"
                target="_blank"
                rel="noreferrer"
              >
                Canadian privacy regulators' principles for generative AI
              </a>
              , including meaningful consent, appropriate purposes, openness,
              safeguards, and limits on retention and secondary use.
            </p>
          ),
        },
      ]}
    />
  );
}

export function CookieNotice() {
  return (
    <LegalPage
      title="Cookie and Analytics Notice"
      summary="The current repository uses essential authentication and preference storage without a third-party browser analytics or error-reporting SDK. No advertising tracker is evident in the application source reviewed for this draft."
      sections={[
        {
          heading: "Essential technologies",
          content: list([
            "Clerk authentication/session technologies used to keep users signed in and protect account requests.",
            "Browser storage used for interface preferences such as theme, where supported.",
            "Security, load-balancing, or hosting cookies that may be set by the production platform and must be inventoried before launch.",
          ]),
        },
        {
          heading: "Diagnostics and advertising",
          content: (
            <>
              <p>
                Kindred does not load a third-party browser analytics or
                error-reporting SDK. Technical server and hosting logs may still
                be processed to operate, secure, and troubleshoot the service;
                their production retention and storage behavior must be
                verified.
              </p>
              <p>
                No Google Analytics, Meta Pixel, advertising network, or similar
                advertising tracker was found in the reviewed repository. This
                notice must be updated before any such technology is enabled.
                Social links in the footer are ordinary outbound links; the site
                does not embed social feeds or pixels.
              </p>
            </>
          ),
        },
        {
          heading: "Controls",
          content: (
            <p>
              Users can use browser controls to remove or block cookies, but
              blocking essential authentication storage may prevent sign-in or
              secure features from working.
            </p>
          ),
        },
        {
          heading: "Required deployment inventory",
          content: (
            <Confirmation>
              Inspect production response headers and browser storage, identify
              cookie names, providers, and lifetimes, confirm Clerk and hosting
              behavior, and determine whether a consent manager is
              required in each supported launch location.
            </Confirmation>
          ),
        },
      ]}
    />
  );
}

export function MarketingConsent() {
  return (
    <LegalPage
      title="Marketing Consent Language"
      summary="This is implementation-ready draft wording for an optional marketing checkbox and consent record. It is not a substitute for a CASL review."
      sections={[
        {
          heading: "Suggested unchecked checkbox",
          content: (
            <div className="rounded-lg border border-border bg-card p-4 text-foreground">
              “Yes, I would like to receive occasional Kindred Asterling AI
              product news, pilot updates, and offers by email. I can
              unsubscribe at any time. Messages will identify the sender and
              include contact and unsubscribe information.”
            </div>
          ),
        },
        {
          heading: "Consent record",
          content: list([
            "Store the exact language/version shown, timestamp, channel, source form, recipient address, jurisdiction information if collected, and proof of the affirmative action.",
            "Keep marketing consent separate from service terms, account creation, reminders, and sensitive wellness-data consent.",
            "Do not pre-check the box. Record withdrawal and suppress future marketing sends across providers.",
          ]),
        },
        {
          heading: "Message requirements",
          content: (
            <p>
              Canadian government guidance describes three main CASL
              requirements for commercial electronic messages: consent, sender
              identification, and a working unsubscribe mechanism. Unsubscribe
              requests must be processed promptly and, according to ISED
              guidance, within 10 business days and at no cost.
            </p>
          ),
        },
        {
          heading: "Official references",
          content: (
            <p>
              Review{" "}
              <a
                className="text-primary underline"
                href="https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email"
                target="_blank"
                rel="noreferrer"
              >
                ISED's consent guidance
              </a>{" "}
              and the{" "}
              <a
                className="text-primary underline"
                href="https://www.crtc.gc.ca/eng/com500/faq500.htm"
                target="_blank"
                rel="noreferrer"
              >
                CRTC CASL FAQ
              </a>{" "}
              before implementation.
            </p>
          ),
        },
        {
          heading: "Required confirmation",
          content: (
            <Confirmation>
              Proposed sender: Kindred Asterling AI. Proposed contact and
              unsubscribe destination:
              kindred_support@kindred-asterling-ai-coaching.com. Confirm whether
              marketing email is enabled, provide a public business mailing
              address, approve the sender name and unsubscribe method, and set
              message categories, consent ownership, proof-retention period, and
              treatment of any implied consents.
            </Confirmation>
          ),
        },
      ]}
    />
  );
}

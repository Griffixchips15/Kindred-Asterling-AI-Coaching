import type { ReactNode } from "react";

interface LegalSection {
  heading: string;
  content: ReactNode;
}

interface LegalPageProps {
  title: string;
  summary: string;
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

function LegalPage({ title, summary, sections }: LegalPageProps) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Draft template — not legal advice
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          {summary}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Last repository review: August 19, 2026
        </p>
      </header>
      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground">
              {section.content}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

const list = (items: ReactNode[]) => (
  <ul className="list-disc space-y-2 pl-5">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This draft reflects the data flows visible in the Kindred repository. It must be reconciled with the deployed infrastructure, contracts, business practices, and applicable law before publication."
      sections={[
        {
          heading: "Who is responsible",
          content: (
            <Confirmation>
              Insert the full legal entity name, business address, privacy
              officer, and privacy-contact email.
            </Confirmation>
          ),
        },
        {
          heading: "Information Kindred handles",
          content: list([
            "Account and identity information, including identity-provider identifiers, email, verification state, name, and profile details you choose to provide.",
            "Wellness and coaching information, including morning and evening reflections, body scans, habits, medication schedules and logs, goals, chat messages, and generated coaching replies.",
            "Optional integration data, including an encrypted Google Calendar refresh token and summarized upcoming-event information, plus reminder preferences, phone number, and time zone when those features are enabled.",
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
                The repository contains integrations for Clerk (identity),
                Helcim (payments), Google Calendar, Twilio (SMS), Resend
                (email), ElevenLabs (voice features), configured AI inference
                providers, and an unspecified hosting/database provider. Data
                should be sent to a provider only when its feature is enabled
                and needed.
              </p>
              <Confirmation>
                Confirm the production provider list, hosting and storage
                regions, cross-border processing, AI-provider retention/training
                terms, subprocessors, and contractual safeguards. Remove
                providers not used in production.
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
                Current internal documentation proposes retaining account data
                for the account lifetime and reminder-delivery records for up to
                90 days, with prompt token revocation on calendar disconnect.
                Those periods are proposals until business and legal review
                confirms them.
              </p>
              <Confirmation>
                Set final retention periods, request-verification steps,
                response timelines, youth-consent approach, and any exceptions
                required by law.
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
      summary="These draft terms describe the current Kindred service but do not become binding until the business identity, commercial terms, and governing law are confirmed and reviewed by counsel."
      sections={[
        {
          heading: "Agreement and eligibility",
          content: (
            <>
              <p>
                By creating an account or using Kindred, a user would agree to
                these terms and the Privacy Policy. Users must provide accurate
                account information and protect their sign-in credentials.
              </p>
              <Confirmation>
                Set the legal entity, effective date, minimum age,
                parental-consent rules, supported locations, and process for
                accepting updated terms.
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
                The interface currently advertises yearly and lifetime access
                and delegates checkout to Helcim. Prices, taxes, renewal,
                cancellation, refunds, failed payments, and the precise meaning
                of “lifetime” must be disclosed before purchase.
              </p>
              <Confirmation>
                Approve prices, trial rules, refund/cancellation policy, renewal
                notices, consumer-law disclosures, and what “lifetime” means if
                the service changes or closes.
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
                limits, indemnity language, dispute process, governing law,
                venue, severability, assignment, and notices for the actual
                business jurisdiction.
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
          heading: "Required review",
          content: (
            <Confirmation>
              Confirm clinical-risk review, supported jurisdictions, emergency
              wording, medication feature boundaries, accessibility, and whether
              any regulated-health or youth-specific obligations apply.
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
                The current server supports locally operated Ollama or a
                configured OpenAI-compatible service. Other AI integration
                packages exist in the workspace but should not be described as
                production processors unless actually enabled.
              </p>
              <Confirmation>
                Name the production model provider, model, processing location,
                retention, abuse monitoring, training policy, human-review
                access, and opt-out/consent choices.
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
      summary="The current repository uses essential authentication and preference storage. No third-party analytics or advertising tracker is evident in the application source reviewed for this draft."
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
          heading: "Analytics and advertising",
          content: (
            <p>
              No Google Analytics, Meta Pixel, advertising network, or similar
              analytics package was found in the reviewed repository. This
              notice must be updated before any such technology is enabled.
              Social links in the footer are ordinary outbound links; the site
              does not embed social feeds or pixels.
            </p>
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
              cookie names/providers/lifetimes, confirm hosting and Clerk
              behavior, and determine whether a consent manager is required in
              each supported jurisdiction.
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
              “Yes, I would like to receive occasional Kindred Asterling product
              news, pilot updates, and offers by email. I can unsubscribe at any
              time. Messages will identify the sender and include contact and
              unsubscribe information.”
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
              Insert the legal sender name, current mailing address, contact
              method, unsubscribe destination, message categories, consent
              owner, proof-retention period, and treatment of existing implied
              consents.
            </Confirmation>
          ),
        },
      ]}
    />
  );
}

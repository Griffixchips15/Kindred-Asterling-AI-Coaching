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
          Working draft — not legal advice
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          {summary}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Last repository review: August 24, 2026
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
                (payments), Google Calendar (optional read-only access), Sentry
                (error and performance monitoring when enabled), Twilio (SMS),
                Resend (email), and ElevenLabs (voice features). Data should be
                sent to a provider only when its feature is enabled and needed.
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
      summary="The current repository uses essential authentication and preference storage and supports Sentry diagnostics when configured. No advertising tracker is evident in the application source reviewed for this draft."
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
                Sentry may process technical error, performance, log, and
                error-triggered session-replay information when configured. The
                reviewed configuration is intended to avoid direct user
                information and request-body capture, but production behavior,
                retention, and any browser storage must be verified.
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
              cookie names, providers, and lifetimes, confirm Sentry, Clerk, and
              hosting behavior, and determine whether a consent manager is
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

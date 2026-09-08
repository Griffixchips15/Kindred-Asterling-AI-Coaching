import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HealthDisclaimer,
  PrivacyPolicy,
  TermsAndConditions,
} from "./legal";

describe("legal document publication state", () => {
  it.each([
    ["Privacy Policy", PrivacyPolicy],
    ["Terms and Conditions", TermsAndConditions],
  ])("renders %s as published", (_title, Component) => {
    const html = renderToStaticMarkup(<Component />);

    expect(html).toContain("Legal information");
    expect(html).toContain("Published");
    expect(html).not.toContain("Final Review Draft");
    expect(html).not.toContain("Working draft");
    expect(html).not.toContain("not for distribution");
  });

  it("keeps documents without the flag in draft review state", () => {
    const html = renderToStaticMarkup(<HealthDisclaimer />);

    expect(html).toContain("Working draft — not legal advice");
    expect(html).toContain("1.0 (Final Review Draft)");
    expect(html).toContain("Subject to Final Legal Counsel Approval");
    expect(html).toContain("not for distribution");
  });
});

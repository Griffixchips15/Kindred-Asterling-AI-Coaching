import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/helcim-subscription-webhooks.json";
import {
  parseHelcimEvent,
  signedCustomerReference,
  verifyCustomerReference,
} from "./helcimClient";

describe("Helcim subscription webhook contracts", () => {
  it.each(fixtures.fixtures)("parses $scenario", (fixture) => {
    const event = parseHelcimEvent(fixture.body as Record<string, unknown>);
    expect(event.customerId).toBeTruthy();
    expect(event.eventType).toBeTruthy();
  });

  it("signs an internal user reference without exposing email", () => {
    process.env.HELCIM_CUSTOMER_REFERENCE_SECRET = "contract-test-secret";
    const reference = signedCustomerReference("internal-user-123");
    expect(reference).not.toContain("@");
    expect(verifyCustomerReference(reference)).toBe("internal-user-123");
    expect(verifyCustomerReference(`${reference}x`)).toBeNull();
  });
});

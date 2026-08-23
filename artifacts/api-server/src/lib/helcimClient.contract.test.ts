import { describe, expect, it, vi } from "vitest";
import fixtures from "./__fixtures__/helcim-subscription-webhooks.json";
import {
  createHelcimCustomer,
  parseHelcimEvent,
  signedCustomerReference,
  verifyCustomerReference,
} from "./helcimClient";

describe("Helcim subscription webhook contracts", () => {
  it("authenticates customer creation with Helcim's api-token header", async () => {
    process.env.HELCIM_API_KEY = "contract-test-api-key";
    process.env.HELCIM_CUSTOMER_REFERENCE_SECRET = "contract-test-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { customerCode: "customer-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createHelcimCustomer({
        id: "internal-user-123",
        email: "user@example.test",
      }),
    ).resolves.toBe("customer-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.helcim.com/v2/customers",
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-token": "contract-test-api-key",
        }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      customerCode: signedCustomerReference("internal-user-123"),
      contactName: "user@example.test",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      "Authorization",
    );
    fetchMock.mockRestore();
  });

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

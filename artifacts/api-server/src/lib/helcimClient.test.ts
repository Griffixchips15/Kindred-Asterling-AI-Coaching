import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isHelcimConfigured,
  isCheckoutConfigured,
  verifyHelcimWebhook,
  parseHelcimEvent,
  getHelcimCustomerEmail
} from "./helcimClient";
import crypto from "node:crypto";
import { logger } from "./logger";

vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe("helcimClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("isHelcimConfigured", () => {
    it("should return true when HELCIM_API_KEY is set", () => {
      process.env.HELCIM_API_KEY = "test_key";
      expect(isHelcimConfigured()).toBe(true);
    });

    it("should return false when HELCIM_API_KEY is not set", () => {
      delete process.env.HELCIM_API_KEY;
      expect(isHelcimConfigured()).toBe(false);
    });
  });

  describe("isCheckoutConfigured", () => {
    it("should return true when all required env vars are set", () => {
      process.env.HELCIM_API_KEY = "test_key";
      process.env.HELCIM_YEARLY_PLAN_ID = "plan_123";
      process.env.HELCIM_LIFETIME_PRODUCT_ID = "prod_456";
      expect(isCheckoutConfigured()).toBe(true);
    });

    it("should return false if HELCIM_API_KEY is missing", () => {
      delete process.env.HELCIM_API_KEY;
      process.env.HELCIM_YEARLY_PLAN_ID = "plan_123";
      process.env.HELCIM_LIFETIME_PRODUCT_ID = "prod_456";
      expect(isCheckoutConfigured()).toBe(false);
    });

    it("should return false if HELCIM_YEARLY_PLAN_ID is missing", () => {
      process.env.HELCIM_API_KEY = "test_key";
      delete process.env.HELCIM_YEARLY_PLAN_ID;
      process.env.HELCIM_LIFETIME_PRODUCT_ID = "prod_456";
      expect(isCheckoutConfigured()).toBe(false);
    });

    it("should return false if HELCIM_LIFETIME_PRODUCT_ID is missing", () => {
      process.env.HELCIM_API_KEY = "test_key";
      process.env.HELCIM_YEARLY_PLAN_ID = "plan_123";
      delete process.env.HELCIM_LIFETIME_PRODUCT_ID;
      expect(isCheckoutConfigured()).toBe(false);
    });
  });

  describe("verifyHelcimWebhook", () => {
    const mockSecret = Buffer.from("supersecretkey").toString("base64");
    const mockWebhookId = "evt_123";
    const mockBody = JSON.stringify({ eventType: "checkout.completed" });

    beforeEach(() => {
      process.env.HELCIM_WEBHOOK_SECRET = mockSecret;
      vi.spyOn(Date, "now").mockImplementation(() => 1000000000); // Set fixed time
    });

    it("should return false if HELCIM_WEBHOOK_SECRET is missing", () => {
      delete process.env.HELCIM_WEBHOOK_SECRET;
      expect(verifyHelcimWebhook(mockBody, {})).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("HELCIM_WEBHOOK_SECRET not configured — rejecting webhook");
    });

    it("should return false if headers are missing", () => {
      expect(verifyHelcimWebhook(mockBody, {})).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("Missing Helcim webhook headers");
    });

    it("should return false if timestamp is too old", () => {
      const oldTimestamp = (Date.now() / 1000 - 301).toString();
      const headers = {
        "webhook-id": mockWebhookId,
        "webhook-timestamp": oldTimestamp,
        "webhook-signature": "v1,signature",
      };

      expect(verifyHelcimWebhook(mockBody, headers)).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ timestampAge: expect.any(Number) }),
        "Helcim webhook timestamp too old"
      );
    });

    it("should return true for a valid signature", () => {
      const timestamp = (Date.now() / 1000).toString();
      const signedContent = `${mockWebhookId}.${timestamp}.${mockBody}`;

      const keyBytes = Buffer.from(mockSecret, "base64");
      const signature = crypto
        .createHmac("sha256", keyBytes)
        .update(signedContent)
        .digest("base64");

      const headers = {
        "webhook-id": mockWebhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${signature}`,
      };

      expect(verifyHelcimWebhook(mockBody, headers)).toBe(true);
    });

    it("should return true when there are multiple signatures and one matches", () => {
      const timestamp = (Date.now() / 1000).toString();
      const signedContent = `${mockWebhookId}.${timestamp}.${mockBody}`;

      const keyBytes = Buffer.from(mockSecret, "base64");
      const validSignature = crypto
        .createHmac("sha256", keyBytes)
        .update(signedContent)
        .digest("base64");

      const headers = {
        "webhook-id": mockWebhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,invalidsig v1,${validSignature}`,
      };

      expect(verifyHelcimWebhook(mockBody, headers)).toBe(true);
    });

    it("should return false for an invalid signature", () => {
      const timestamp = (Date.now() / 1000).toString();
      const headers = {
        "webhook-id": mockWebhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": "v1,badsignature",
      };

      expect(verifyHelcimWebhook(mockBody, headers)).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("Helcim webhook signature mismatch");
    });
  });

  describe("parseHelcimEvent", () => {
    it("should parse standard helcim event format", () => {
      const body = {
        eventType: "checkout.completed",
        data: {
          customer: { id: "cust_123", email: "test@example.com" },
          subscriptionId: "sub_123",
          planId: "plan_456"
        }
      };

      const result = parseHelcimEvent(body);
      expect(result).toEqual({
        eventType: "checkout.completed",
        customerId: "cust_123",
        customerEmail: "test@example.com",
        subscriptionId: "sub_123",
        planId: "plan_456",
        data: body.data
      });
    });

    it("should parse alternative snake_case format", () => {
      const body = {
        event_type: "subscription.created",
        customer: { id: "cust_999", email: "snake@example.com" },
        data: {
          subscription_id: "sub_999",
          plan_id: "plan_999"
        }
      };

      const result = parseHelcimEvent(body);
      expect(result).toEqual({
        eventType: "subscription.created",
        customerId: "cust_999",
        customerEmail: "snake@example.com",
        subscriptionId: "sub_999",
        planId: "plan_999",
        data: body.data
      });
    });

    it("should handle missing fields gracefully", () => {
      const result = parseHelcimEvent({});
      expect(result).toEqual({
        eventType: "",
        customerId: undefined,
        customerEmail: undefined,
        subscriptionId: undefined,
        planId: undefined,
        data: {}
      });
    });
  });

  describe("getHelcimCustomerEmail", () => {
    const mockApiKey = "api_key_123";

    beforeEach(() => {
      process.env.HELCIM_API_KEY = mockApiKey;
      global.fetch = vi.fn();
    });

    it("should return null if HELCIM_API_KEY is missing", async () => {
      delete process.env.HELCIM_API_KEY;
      expect(await getHelcimCustomerEmail("cust_123")).toBeNull();
    });

    it("should return null and warn for invalid customer ID", async () => {
      expect(await getHelcimCustomerEmail("invalid/id")).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: "invalid/id" }),
        "Invalid Helcim customer ID format"
      );
    });

    it("should return email on successful fetch", async () => {
      const mockEmail = "customer@example.com";
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { email: mockEmail } })
      } as Response);

      const email = await getHelcimCustomerEmail("cust_123");
      expect(email).toBe(mockEmail);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.helcim.com/v2/customers/cust_123",
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            "Content-Type": "application/json"
          }
        })
      );
    });

    it("should return null if fetch fails (res.ok is false)", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false
      } as Response);

      const email = await getHelcimCustomerEmail("cust_123");
      expect(email).toBeNull();
    });

    it("should return null and log error if fetch throws", async () => {
      const error = new Error("Network error");
      vi.mocked(global.fetch).mockRejectedValueOnce(error);

      const email = await getHelcimCustomerEmail("cust_123");
      expect(email).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        "Helcim getCustomerEmail failed"
      );
    });
  });
});

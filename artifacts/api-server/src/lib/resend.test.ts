import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEmailConfigured, sendEmail } from "./resend";
import { logger } from "./logger";

// Mock the logger
vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("resend", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and mocks before each test
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isEmailConfigured", () => {
    it("returns false if both RESEND_API_KEY and RESEND_FROM_EMAIL are missing", () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_FROM_EMAIL;
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns false if only RESEND_API_KEY is missing", () => {
      delete process.env.RESEND_API_KEY;
      process.env.RESEND_FROM_EMAIL = "test@example.com";
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns false if only RESEND_FROM_EMAIL is missing", () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      delete process.env.RESEND_FROM_EMAIL;
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true if both are present", () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "test@example.com";
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("returns false and logs warning if missing API key", async () => {
      delete process.env.RESEND_API_KEY;
      process.env.RESEND_FROM_EMAIL = "test@example.com";

      const result = await sendEmail("to@example.com", "Subject", "Body text");

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("sendEmail called but Resend is not configured");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns false and logs warning if missing from email", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      delete process.env.RESEND_FROM_EMAIL;

      const result = await sendEmail("to@example.com", "Subject", "Body text");

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith("sendEmail called but Resend is not configured");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sends email successfully without html", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "from@example.com";

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await sendEmail("to@example.com", "Test Subject", "Test Text");

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "from@example.com",
          to: ["to@example.com"],
          subject: "Test Subject",
          text: "Test Text",
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it("sends email successfully with html", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "from@example.com";

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await sendEmail(
        "to@example.com",
        "Test Subject",
        "Test Text",
        "<p>Test HTML</p>"
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "from@example.com",
          to: ["to@example.com"],
          subject: "Test Subject",
          text: "Test Text",
          html: "<p>Test HTML</p>",
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it("returns false and logs error on non-ok fetch response", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "from@example.com";

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request Error"),
      } as unknown as Response);

      const result = await sendEmail("to@example.com", "Test Subject", "Test Text");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { status: 400, detail: "Bad Request Error" },
        "Resend send email failed"
      );
    });

    it("handles fetch response text rejection", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "from@example.com";

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error("Cannot read body")),
      } as unknown as Response);

      const result = await sendEmail("to@example.com", "Test Subject", "Test Text");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { status: 500, detail: "" },
        "Resend send email failed"
      );
    });

    it("returns false and logs error when fetch throws", async () => {
      process.env.RESEND_API_KEY = "sk_test_123";
      process.env.RESEND_FROM_EMAIL = "from@example.com";

      const testError = new Error("Network Error");
      vi.mocked(global.fetch).mockRejectedValueOnce(testError);

      const result = await sendEmail("to@example.com", "Test Subject", "Test Text");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { err: testError },
        "Resend send email threw"
      );
    });
  });
});

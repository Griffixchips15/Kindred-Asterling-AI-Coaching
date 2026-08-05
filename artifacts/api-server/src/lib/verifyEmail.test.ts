import { describe, it, expect } from "vitest";
import { escapeHtml } from "./verifyEmail";

describe("escapeHtml", () => {
  it("returns an empty string when given an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns the original string when it contains no special characters", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes ampersands (&)", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than signs (<)", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than signs (>)", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes (\")", () => {
    expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
  });

  it("escapes single quotes (')", () => {
    expect(escapeHtml("'single'")).toBe("&#39;single&#39;");
  });

  it("escapes multiple different special characters", () => {
    expect(escapeHtml('<a href="test&id=\'1\'">Link</a>')).toBe("&lt;a href=&quot;test&amp;id=&#39;1&#39;&quot;&gt;Link&lt;/a&gt;");
  });
});

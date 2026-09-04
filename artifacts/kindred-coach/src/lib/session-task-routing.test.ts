import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Clerk session task routing", () => {
  const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

  it("does not mount protected pages for a pending session", () => {
    expect(app).toContain('sessionStatus === "pending"');
    expect(app).toContain("return <RedirectToTasks />");
    expect(app).toContain('sessionStatus !== "pending" && !isSignedIn');
  });

  it("provides a completion screen for every supported Clerk task", () => {
    expect(app).toContain('"choose-organization":');
    expect(app).toContain('"reset-password":');
    expect(app).toContain('"setup-mfa":');
    expect(app).toContain("<TaskChooseOrganization");
    expect(app).toContain("<TaskResetPassword");
    expect(app).toContain("<TaskSetupMFA");
  });
});

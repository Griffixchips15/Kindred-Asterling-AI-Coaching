import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Phase 2B.2 consolidation: every primary-area page must surface its area's
// other destinations (and the secondary pages must link back), driven by the
// Phase 2A navigation model. Structural assertions follow the repo's
// source-test convention (see session-task-routing.test.ts).

function read(page: string): string {
  return readFileSync(resolve(process.cwd(), `src/pages/${page}`), "utf8");
}

/**
 * Asserts a control with the given test id carries the 44px touch target and a
 * visible focus ring (the className literal sits immediately before its
 * data-testid in the JSX source).
 */
function expectTouchTargetAndFocusRing(source: string, testId: string): void {
  expect(source).toMatch(
    new RegExp(
      `className="[^"]*min-h-11[^"]*focus-visible:ring-2[^"]*"\\s*\\n\\s*data-testid="${testId}"`,
    ),
  );
}

describe("primary-area destination coherence", () => {
  it("Talk: the conversation page links to archived conversations", () => {
    const chat = read("chat.tsx");
    expect(chat).toContain('href="/archive"');
    expect(chat).toContain('data-testid="talk-archive-link"');
    expect(chat).toContain("Archived conversations");
    expectTouchTargetAndFocusRing(chat, "talk-archive-link");
  });

  it("Talk: the archive page links back to the conversation", () => {
    const archive = read("archive.tsx");
    expect(archive).toContain('href="/chat"');
    expect(archive).toContain('data-testid="talk-chat-link"');
    expectTouchTargetAndFocusRing(archive, "talk-chat-link");
  });

  it("You: the profile page links to account security", () => {
    const profile = read("profile.tsx");
    expect(profile).toContain('href="/account"');
    expect(profile).toContain('data-testid="you-account-link"');
    expect(profile).toContain("Account security");
    expectTouchTargetAndFocusRing(profile, "you-account-link");
  });

  it("You: the account security page links back to the profile", () => {
    const account = read("account.tsx");
    expect(account).toContain('href="/profile"');
    expect(account).toContain('data-testid="you-profile-link"');
    expectTouchTargetAndFocusRing(account, "you-profile-link");
  });

  it("Insights: the reports page presents itself as the Insights area home", () => {
    const reports = read("reports.tsx");
    expect(reports).toMatch(/<h1[^>]*>\s*Insights\s*<\/h1>/);
    expect(reports).not.toMatch(/<h1[^>]*>\s*Reports\s*<\/h1>/);
  });
});

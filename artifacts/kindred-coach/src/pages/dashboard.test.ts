import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard medication-effectiveness chart", () => {
  const dashboard = readFileSync(
    resolve(process.cwd(), "src/pages/dashboard.tsx"),
    "utf8",
  );

  it("labels the chart to match its medicationEffectiveness dataKey", () => {
    expect(dashboard).toContain('dataKey="medicationEffectiveness"');
    expect(dashboard).toContain("Medication Effectiveness");
    expect(dashboard).toContain('name="Medication effectiveness"');
  });

  it("does not claim medication effectiveness represents mood", () => {
    expect(dashboard).not.toContain("Recent Mood");
    expect(dashboard).toContain("How effective your medication felt over the last 7 days");
    expect(dashboard).toContain(
      'aria-label="Medication effectiveness over the last 7 days, rated 1 to 10"',
    );
  });
});

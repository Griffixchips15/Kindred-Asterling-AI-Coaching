import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("React Query singleton configuration", () => {
  it("deduplicates React Query in the Kindred Vite bundle", () => {
    const viteConfig = readFileSync(
      resolve(process.cwd(), "vite.config.ts"),
      "utf8",
    );

    expect(viteConfig).toContain(
      'dedupe: ["react", "react-dom", "@tanstack/react-query"]',
    );
  });

  it("requires consumers to provide the React Query runtime", () => {
    const apiClientPackage = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../../lib/api-client-react/package.json"),
        "utf8",
      ),
    ) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(apiClientPackage.dependencies ?? {}).not.toHaveProperty(
      "@tanstack/react-query",
    );
    expect(apiClientPackage.peerDependencies).toHaveProperty(
      "@tanstack/react-query",
    );
  });
});

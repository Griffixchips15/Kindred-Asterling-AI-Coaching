import { describe, expect, it, vi } from "vitest";
import { createAuth0ProfileLoader } from "./auth0Profile";

function fixture() {
  let time = 1_000_000;
  const profileFetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          sub: "auth0|one",
          email: "one@example.test",
          email_verified: true,
        }),
      ),
  );
  const load = createAuth0ProfileLoader({
    issuerBaseURL: "https://issuer.example/",
    profileFetch,
    now: () => time,
    maxEntries: 2,
  });
  return {
    load,
    profileFetch,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
describe("Auth0 UserInfo request cache", () => {
  it("shares concurrent requests for the same verified token", async () => {
    const { load, profileFetch } = fixture();
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        load("test-token-one", "auth0|one", 2_000_000),
      ),
    );
    expect(profileFetch).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.id === "auth0|one" && r.emailVerified)).toBe(
      true,
    );
  });
  it("does not share profile claims across different tokens", async () => {
    const { load, profileFetch } = fixture();
    await load("test-token-one", "auth0|one", 2_000_000);
    profileFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sub: "auth0|two" })),
    );
    expect((await load("test-token-two", "auth0|two", 2_000_000)).id).toBe(
      "auth0|two",
    );
    expect(profileFetch).toHaveBeenCalledTimes(2);
  });
  it("refreshes after one minute or token expiry, whichever comes first", async () => {
    const { load, profileFetch, advance } = fixture();
    await load("test-token-one", "auth0|one", 2_000_000);
    advance(60_000);
    await load("test-token-one", "auth0|one", 2_000_000);
    await load("test-token-short", "auth0|one", 1_061_000);
    advance(1000);
    await load("test-token-short", "auth0|one", 1_061_000);
    expect(profileFetch).toHaveBeenCalledTimes(4);
  });
  it("bounds memory and fetches an evicted entry again", async () => {
    const { load, profileFetch } = fixture();
    for (const token of ["one", "two", "three", "one"])
      await load(token, "auth0|one", 2_000_000);
    expect(profileFetch).toHaveBeenCalledTimes(4);
  });
  it("does not cache failures or mismatched subjects", async () => {
    const { load, profileFetch } = fixture();
    profileFetch.mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(load("one", "auth0|one", 2_000_000)).rejects.toThrow("429");
    profileFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ sub: "auth0|other" })),
    );
    await expect(load("one", "auth0|one", 2_000_000)).rejects.toThrow(
      "subject mismatch",
    );
    await expect(load("one", "auth0|one", 2_000_000)).resolves.toMatchObject({
      id: "auth0|one",
    });
    expect(profileFetch).toHaveBeenCalledTimes(3);
  });
});

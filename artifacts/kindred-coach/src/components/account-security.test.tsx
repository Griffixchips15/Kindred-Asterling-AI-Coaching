import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getAuthenticationMethods: vi.fn(),
  getFactors: vi.fn(),
  enrollmentChallenge: vi.fn(),
  enrollmentVerify: vi.fn(),
  deleteAuthenticationMethod: vi.fn(),
  loginWithRedirect: vi.fn(),
}));
vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    myAccount: mocks,
    loginWithRedirect: mocks.loginWithRedirect,
  }),
}));
import { AccountSecurity } from "./account-security";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticationMethods.mockResolvedValue([
    { id: "factor-1", type: "totp", name: "My phone", usage: ["secondary"] },
  ]);
  mocks.getFactors.mockResolvedValue([{ type: "totp" }, { type: "phone" }]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (node) => node.textContent === name,
  )!;
async function render() {
  await act(async () => root.render(createElement(AccountSecurity)));
}
describe("account-security operations", () => {
  it("requires confirmation before deleting a method and refreshes the list", async () => {
    await render();
    await act(async () => button("Remove").click());
    expect(mocks.deleteAuthenticationMethod).not.toHaveBeenCalled();
    await act(async () => button("Confirm removal").click());
    expect(mocks.deleteAuthenticationMethod).toHaveBeenCalledWith("factor-1");
    expect(container.textContent).toContain("Sign-in method removed.");
  });
  it("does not claim success when the provider rejects deletion", async () => {
    mocks.deleteAuthenticationMethod.mockRejectedValueOnce(
      new Error("Step up required"),
    );
    await render();
    await act(async () => button("Remove").click());
    await act(async () => button("Confirm removal").click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Sign-in method removed.");
  });
  it("shows a TOTP setup key from the SDK challenge and clears it on cancel", async () => {
    mocks.enrollmentChallenge.mockResolvedValueOnce({
      type: "totp",
      manual_input_code: "SYNTHETIC-TEST-KEY",
      location: "method/one",
      auth_session: "test-session",
    });
    await render();
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mocks.enrollmentChallenge).toHaveBeenCalledWith({ type: "totp" });
    expect(container.textContent).toContain("SYNTHETIC-TEST-KEY");
    await act(async () => button("Cancel").click());
    expect(container.textContent).not.toContain("SYNTHETIC-TEST-KEY");
    expect(mocks.enrollmentVerify).not.toHaveBeenCalled();
  });
});

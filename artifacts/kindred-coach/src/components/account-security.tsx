import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";

type MyAccount = ReturnType<typeof useAuth0>["myAccount"];
type Method = Awaited<
  ReturnType<MyAccount["getAuthenticationMethods"]>
>[number];
type Challenge = Awaited<ReturnType<MyAccount["enrollmentChallenge"]>>;
const label: Record<string, string> = {
  totp: "Authenticator app",
  phone: "Phone verification",
  password: "Password",
  email: "Email",
  passkey: "Passkey",
  "recovery-code": "Recovery codes",
};

export function AccountSecurity() {
  const { myAccount, loginWithRedirect } = useAuth0();
  const [methods, setMethods] = useState<Method[]>([]);
  const [factors, setFactors] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<Challenge>();
  const [type, setType] = useState<"totp" | "phone" | "password">("totp");
  const [phone, setPhone] = useState("");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removeId, setRemoveId] = useState<string>();
  const refresh = useCallback(async () => {
    const [current, available] = await Promise.all([
      myAccount.getAuthenticationMethods(),
      myAccount.getFactors(),
    ]);
    setMethods(current);
    setFactors(available.map((factor) => factor.type));
  }, [myAccount]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch {
      setError(
        "Account security could not be updated. Verify your sign-in and try again. If this continues, contact Kindred support.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    setBusy(true);
    Promise.all([myAccount.getAuthenticationMethods(), myAccount.getFactors()])
      .then(([current, available]) => {
        if (active) {
          setMethods(current);
          setFactors(available.map((f) => f.type));
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Account security is temporarily unavailable. Verify your sign-in and try again, or contact Kindred support.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [myAccount]);
  const begin = async () => {
    const options =
      type === "phone"
        ? {
            type: "phone" as const,
            phone_number: phone,
            preferred_authentication_method: "sms" as const,
          }
        : { type };
    setChallenge(await myAccount.enrollmentChallenge(options));
    setCredential("");
  };
  const verify = async () => {
    if (!challenge) return;
    const common = {
      location: challenge.location,
      auth_session: challenge.auth_session,
    };
    await myAccount.enrollmentVerify(
      type === "password"
        ? { ...common, type: "password", new_password: credential }
        : { ...common, type, otp_code: credential },
    );
    setChallenge(undefined);
    setCredential("");
    setPhone("");
    await refresh();
    setMessage("Your account security has been updated.");
  };
  return (
    <section
      className="max-w-xl space-y-5"
      aria-label="Account security controls"
    >
      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive p-4"
        >
          <p>{error}</p>
          <button
            disabled={busy}
            className="underline"
            onClick={() =>
              void run(() =>
                loginWithRedirect({
                  appState: { returnTo: "/app/account" },
                  authorizationParams: { prompt: "login", max_age: 0 },
                }),
              )
            }
          >
            Verify your sign-in
          </button>
          <button
            disabled={busy}
            className="ml-4 underline"
            onClick={() => void run(refresh)}
          >
            Retry
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Updating account security…</p>}
      <ul className="space-y-3">
        {methods.map((method) => (
          <li
            key={method.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <span>
              {label[method.type] ?? method.type}
              {"name" in method && method.name ? ` — ${method.name}` : ""}
            </span>
            {method.type !== "password" && (
              <button
                className="underline"
                disabled={busy}
                onClick={() => setRemoveId(method.id)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {removeId && (
        <div
          className="rounded-lg border p-4"
          role="group"
          aria-label="Confirm removal"
        >
          <p>
            Remove this sign-in method? Make sure you have another way to sign
            in.
          </p>
          <button
            className="mr-4 underline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await myAccount.deleteAuthenticationMethod(removeId);
                setRemoveId(undefined);
                await refresh();
                setMessage("Sign-in method removed.");
              })
            }
          >
            Confirm removal
          </button>
          <button
            className="underline"
            disabled={busy}
            onClick={() => setRemoveId(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
      {!challenge && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(begin);
          }}
        >
          <label className="block">
            Sign-in method
            <select
              className="mt-1 block w-full rounded border bg-background p-2"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              disabled={busy}
            >
              <option value="totp">Authenticator app</option>
              <option value="phone">Phone verification</option>
              <option value="password">Change password</option>
            </select>
          </label>
          {type === "phone" && (
            <label className="block">
              Phone number, including country code
              <input
                className="mt-1 block w-full rounded border bg-background p-2"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
          )}
          {type !== "password" && !factors.includes(type) && !busy && (
            <p className="text-sm text-muted-foreground">
              This sign-in method is not currently available.
            </p>
          )}
          <button
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            disabled={busy || (type !== "password" && !factors.includes(type))}
          >
            Continue
          </button>
        </form>
      )}
      {challenge && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(verify);
          }}
        >
          {type === "totp" && "manual_input_code" in challenge && (
            <p>
              Enter this setup key in your authenticator app:{" "}
              <code className="break-all select-all">
                {challenge.manual_input_code}
              </code>
            </p>
          )}
          <label className="block">
            {type === "password" ? "New password" : "Verification code"}
            <input
              className="mt-1 block w-full rounded border bg-background p-2"
              type={type === "password" ? "password" : "text"}
              inputMode={type === "password" ? "text" : "numeric"}
              autoComplete={
                type === "password" ? "new-password" : "one-time-code"
              }
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              required
            />
          </label>
          <button
            className="mr-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            disabled={busy}
          >
            Save
          </button>
          <button
            type="button"
            className="underline"
            disabled={busy}
            onClick={() => {
              setChallenge(undefined);
              setCredential("");
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useSearch } from "wouter";
import logoPoster from "@/assets/brand/logo-poster.jpg";

type AuthMode = "signin" | "signup";

export default function Login() {
  const { isLoading, isAuthenticated, login, register } = useAuth();
  const params = new URLSearchParams(useSearch());
  const returnTo = params.get("returnTo") || "/";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    window.location.href = returnTo;
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else {
        await register(email, password, firstName || undefined);
      }
      window.location.href = returnTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-10 text-center">
      <div className="flex flex-col items-center">
        <img
          src={logoPoster}
          alt="Kindred Asterling — AI Coaching"
          className="w-60 max-w-[78vw] rounded-2xl shadow-2xl ring-1 ring-border/40"
        />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Kindred Asterling</h1>
        <p className="mt-2 text-muted-foreground text-sm">Your personal daily wellness companion</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl">
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-md px-3 py-2 transition-colors ${
              mode === "signin" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-2 transition-colors ${
              mode === "signup" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {mode === "signup" && (
            <label className="block text-sm font-medium">
              First name <span className="text-muted-foreground font-normal">(optional)</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                autoComplete="given-name"
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

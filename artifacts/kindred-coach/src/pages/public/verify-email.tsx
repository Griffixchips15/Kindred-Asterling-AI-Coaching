import { useState, useEffect } from "react";
import { useSearch, Link } from "wouter";
import logoPoster from "@/assets/brand/logo-poster.jpg";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmail() {
  const params = new URLSearchParams(useSearch());
  const token = params.get("token");
  const [state, setState] = useState<VerifyState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("No verification link provided.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.message === "Email verified") {
          setState("success");
        } else {
          setState("error");
          setErrorMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setErrorMessage("Something went wrong. Please try again.");
      });
  }, [token]);

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
        {state === "loading" && (
          <p className="text-muted-foreground text-sm">Verifying your email...</p>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Email verified!</p>
            <p className="text-muted-foreground text-sm">
              Your account is ready. You can now use all features.
            </p>
            <Link
              href="/"
              className="block w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground text-center transition-colors hover:bg-primary/90"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <p className="text-destructive text-sm">{errorMessage}</p>
            <Link
              href="/login"
              className="block w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground text-center transition-colors hover:bg-primary/90"
            >
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

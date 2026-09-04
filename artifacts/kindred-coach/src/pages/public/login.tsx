import { SignIn, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useSearch } from "wouter";
import logoPoster from "@/assets/brand/logo-poster.jpg";
import { resolveReturnDestination } from "@/lib/routing";

export default function Login() {
  const { isSignedIn, isLoaded } = useUser();
  const params = new URLSearchParams(useSearch());
  const returnTo = resolveReturnDestination(params.get("returnTo"));

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.assign(returnTo);
    }
  }, [isLoaded, isSignedIn, returnTo]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="flex min-h-screen items-center justify-center gap-8 bg-background px-6 py-10">
      <img
        src={logoPoster}
        alt="Kindred Asterling — AI Coaching"
        className="hidden w-48 rounded-2xl shadow-2xl ring-1 ring-border/40 lg:block"
      />
      <div className="w-full max-w-md">
        <SignIn routing="hash" fallbackRedirectUrl={returnTo} />
      </div>
    </div>
  );
}

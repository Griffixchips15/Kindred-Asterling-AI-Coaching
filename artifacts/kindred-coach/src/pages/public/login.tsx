import { useUser, useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useSearch } from "wouter";
import logoPoster from "@/assets/brand/logo-poster.jpg";

export default function Login() {
  const { isSignedIn, isLoaded } = useUser();
  const { redirectToSignIn } = useClerk();
  const params = new URLSearchParams(useSearch());
  const returnTo = params.get("returnTo") || "/app";

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirectToSignIn({ redirectUrl: returnTo });
    }
  }, [isLoaded, isSignedIn, redirectToSignIn, returnTo]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <img
          src={logoPoster}
          alt="Kindred Asterling — AI Coaching"
          className="w-60 max-w-[78vw] rounded-2xl shadow-2xl ring-1 ring-border/40"
        />
        <p className="text-muted-foreground text-sm">Redirecting to sign in...</p>
      </div>
    </div>
  );
}

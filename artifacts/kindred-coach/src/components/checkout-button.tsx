import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createCheckout } from "@workspace/api-client-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheckoutButtonProps {
  planType: "yearly" | "lifetime";
  label: string;
  variant?: ButtonProps["variant"];
  className?: string;
}

// Starts an in-app Helcim checkout. If the visitor isn't signed in yet we send
// them through login first (returning to /pricing) so the Helcim payment is tied
// to the same email they sign in with — that's how access is granted.
export function CheckoutButton({
  planType,
  label,
  variant = "default",
  className,
}: CheckoutButtonProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.href = "/login?returnTo=/pricing";
      return;
    }

    setIsPending(true);
    try {
      // Public routes do not wait for the app-wide token bridge. Fetch and pass
      // the token here so a signed-in buyer can never race that bridge and send
      // an anonymous checkout request.
      const token = await getToken();
      if (!token) {
        setError("Your sign-in session isn't ready. Please sign in again.");
        return;
      }
      const data = await createCheckout(
        { planType },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!data?.checkoutUrl) {
        setError("Unable to start checkout. Please try again.");
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setError("Checkout isn't ready just yet — please try again shortly.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant={variant}
        size="lg"
        onClick={() => void handleClick()}
        disabled={!isLoaded || isPending}
        className="w-full"
        data-testid={`checkout-${planType}`}
      >
        {isPending ? "Redirecting…" : label}
      </Button>
      {error && (
        <p className="text-destructive text-xs text-center leading-snug">
          {error}
        </p>
      )}
    </div>
  );
}

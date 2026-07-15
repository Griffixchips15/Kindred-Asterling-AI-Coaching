import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useCreateCheckout } from "@workspace/api-client-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheckoutButtonProps {
  planType: "yearly" | "lifetime";
  label: string;
  variant?: ButtonProps["variant"];
  className?: string;
}

// Starts an in-app Stripe checkout. If the visitor isn't signed in yet we send
// them through login first (returning to /pricing) so the Stripe payment is tied
// to the same email they sign in with — that's how access is granted.
export function CheckoutButton({
  planType,
  label,
  variant = "default",
  className,
}: CheckoutButtonProps) {
  const { isAuthenticated } = useAuth();
  const { mutate, isPending } = useCreateCheckout();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    if (!isAuthenticated) {
      window.location.href = "/";
      return;
    }
    mutate(
      { data: { planType } },
      {
        onSuccess: (data) => {
          if (data?.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          } else {
            setError("Unable to start checkout. Please try again.");
          }
        },
        onError: () => {
          setError("Checkout isn't ready just yet — please try again shortly.");
        },
      },
    );
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant={variant}
        size="lg"
        onClick={handleClick}
        disabled={isPending}
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

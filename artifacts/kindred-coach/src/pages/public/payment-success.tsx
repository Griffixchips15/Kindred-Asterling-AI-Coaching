import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Helcim redirects here after a successful payment. Entitlement is granted
// asynchronously (Helcim webhook → cached subscription row), so we give the user
// a clear success state plus a "check access" action that re-verifies before
// sending them into the app.
export default function PaymentSuccess() {
  const [checking, setChecking] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const appHref = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/app`;

  const checkAccess = async () => {
    setChecking(true);
    setNotReady(false);
    try {
      const res = await fetch("/api/subscription/status", {
        credentials: "include",
      });
      const data = (await res.json()) as { active?: boolean };
      if (data?.active) {
        window.location.href = appHref;
        return;
      }
      setNotReady(true);
    } catch {
      setNotReady(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-16 md:px-8">
      <Card className="w-full">
        <CardContent className="px-6 py-12 text-center md:px-10">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
            Thank you.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Your payment was received. Access usually unlocks within a moment —
            tap below to enter Kindred. If it's not ready yet, give it a few
            seconds and try again.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={checkAccess}
              disabled={checking}
              className="w-full sm:w-auto"
              data-testid="check-access"
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Enter Kindred"
              )}
            </Button>
            {notReady && (
              <p className="text-sm text-muted-foreground">
                Not active just yet. Please wait a few seconds and try again.
              </p>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

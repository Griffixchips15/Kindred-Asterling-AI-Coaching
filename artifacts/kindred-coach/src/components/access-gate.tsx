import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";

type AccessState =
  | { kind: "loading" }
  | { kind: "active"; source: string }
  | { kind: "unverified" }
  | { kind: "inactive" }
  | { kind: "error" };

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const [access, setAccess] = useState<AccessState>({ kind: "loading" });

  const checkAccess = useCallback(async () => {
    setAccess({ kind: "loading" });
    try {
      const response = await fetch("/api/subscription/status", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        active?: boolean;
        status?: string;
        source?: string;
      };
      if (data.active) {
        setAccess({ kind: "active", source: data.source ?? "none" });
      } else if (data.status === "unverified") {
        setAccess({ kind: "unverified" });
      } else {
        setAccess({ kind: "inactive" });
      }
    } catch {
      setAccess({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) void checkAccess();
  }, [checkAccess, isSignedIn]);

  if (!isSignedIn) return null;

  if (access.kind === "unverified") {
    return (
      <GateShell
        icon={<MailCheck className="h-7 w-7" />}
        title="Verify your email"
        description="Please check your email and click the verification link from Clerk to access the app."
      />
    );
  }

  if (access.kind === "active") return <>{children}</>;
  if (access.kind === "loading") {
    return (
      <GateShell
        icon={<Loader2 className="h-7 w-7 animate-spin" />}
        title="Checking access"
        description="Confirming your private beta invitation."
      />
    );
  }
  if (access.kind === "error") {
    return (
      <GateShell
        icon={<RefreshCw className="h-7 w-7" />}
        title="Access check unavailable"
        description="Kindred could not confirm access. Your account data has not been changed."
      >
        <Button onClick={checkAccess}>Try again</Button>
      </GateShell>
    );
  }

  return (
    <GateShell
      icon={<MailCheck className="h-7 w-7" />}
      title="Private beta invitation pending"
      description="Your email is verified. The Kindred team still needs to activate your beta invitation."
    >
      <Button asChild variant="outline">
        <Link href="~/pricing">View future plans</Link>
      </Button>
      <Button onClick={checkAccess} variant="ghost">
        Check again
      </Button>
    </GateShell>
  );
}

function GateShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-center">
      <section className="w-full max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children ? (
          <div className="mt-6 flex flex-col items-center gap-3">{children}</div>
        ) : null}
      </section>
    </main>
  );
}

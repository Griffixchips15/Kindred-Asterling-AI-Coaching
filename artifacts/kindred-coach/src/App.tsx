import { useState, type FormEvent } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { PublicLayout } from "@/components/layout/public-layout";
import Dashboard from "@/pages/dashboard";
import Morning from "@/pages/morning";
import Scans from "@/pages/scans";
import Evening from "@/pages/evening";
import Habits from "@/pages/habits";
import Medications from "@/pages/medications";
import Reports from "@/pages/reports";
import Profile from "@/pages/profile";
import CalendarPage from "@/pages/calendar";
import Chat from "@/pages/chat";
import Archive from "@/pages/archive";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/public/landing";
import About from "@/pages/public/about";
import Science from "@/pages/public/science";
import Pricing from "@/pages/public/pricing";
import PaymentSuccess from "@/pages/public/payment-success";
import Login from "@/pages/public/login";
import VerifyEmail from "@/pages/public/verify-email";
import { useAuth } from "@workspace/replit-auth-web";
import { ThemeProvider } from "@/hooks/use-theme";
import logoPoster from "@/assets/brand/logo-poster.jpg";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

type AuthMode = "signin" | "signup";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6py-10text-center">
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
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1text-sm">
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
                First name <span className="text-muted-foreground font-normal">(optional)</span><input
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

  return <>{children}</>;
}

function PublicRoutes() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/about" component={About} />
        <Route path="/science" component={Science} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/payment-success" component={PaymentSuccess} />
        <Route path="/login" component={Login} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function PrivateRoutes() {
  return (
    <AuthGate>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/morning" component={Morning} />
          <Route path="/scans" component={Scans} />
          <Route path="/evening" component={Evening} />
          <Route path="/habits" component={Habits} />
          <Route path="/medications" component={Medications} />
          <Route path="/reports" component={Reports} />
          <Route path="/profile" component={Profile} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/chat" component={Chat} />
          <Route path="/archive" component={Archive} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={PublicRoutes} />
              <Route path="/about" component={PublicRoutes} />
              <Route path="/science" component={PublicRoutes} />
              <Route path="/pricing" component={PublicRoutes} />
              <Route path="/payment-success" component={PublicRoutes} />
              <Route path="/login" component={PublicRoutes} />
              <Route path="/verify-email" component={PublicRoutes} />
              <Route component={PrivateRoutes} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

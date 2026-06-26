import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
  Link,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
import { PublicLayout } from "@/components/layout/public-layout";
import Landing from "@/pages/public/landing";
import About from "@/pages/public/about";
import Science from "@/pages/public/science";
import Pricing from "@/pages/public/pricing";
import PaymentSuccess from "@/pages/public/payment-success";
import Dashboard from "@/pages/dashboard";
import Morning from "@/pages/morning";
import Scans from "@/pages/scans";
import Evening from "@/pages/evening";
import Habits from "@/pages/habits";
import Medications from "@/pages/medications";
import Reports from "@/pages/reports";
import Profile from "@/pages/profile";
import Reminders from "@/pages/reminders";
import CalendarPage from "@/pages/calendar";
import Chat from "@/pages/chat";
import Archive from "@/pages/archive";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetSubscriptionStatus, getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";
import { ThemeProvider } from "@/hooks/use-theme";
import { Lock } from "lucide-react";
import logoPoster from "@/assets/brand/logo-poster.jpg";
import logoMark from "@/assets/brand/logo-mark.png";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[38%] h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <img
            src={logoMark}
            alt="Kindred Asterling"
            className="h-24 w-24 rounded-2xl shadow-2xl ring-1 ring-border/50"
          />
          <h1 className="mt-6 font-serif text-3xl tracking-tight text-foreground">
            Kindred Asterling
          </h1>
          <p className="mt-2 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            AI Coaching
          </p>

          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            A calmer, more honest way to check in with yourself — with a companion who
            actually remembers.
          </p>

          <button
            onClick={login}
            className="mt-8 w-full rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="button-login"
          >
            Sign in to continue
          </button>

          <Link
            href="~/"
            className="mt-4 rounded text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Learn more about Kindred Asterling
          </Link>

          <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Lock className="h-3 w-3" />
            Private by design. Your reflections stay yours.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isFetching, refetch } = useGetSubscriptionStatus({
    query: { queryKey: getGetSubscriptionStatusQueryKey() },
  });
  const { logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (data?.active) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-7 bg-background px-6 text-center">
      <div className="flex flex-col items-center">
        <img
          src={logoPoster}
          alt="Kindred Asterling — AI Coaching"
          className="w-48 max-w-[70vw] rounded-2xl shadow-2xl ring-1 ring-border/40"
        />
        <h1 className="mt-6 text-2xl font-serif text-foreground tracking-tight">
          Subscribe to continue
        </h1>
        <p className="mt-3 max-w-sm text-muted-foreground text-sm leading-relaxed">
          Kindred Asterling is a subscription. Pick a plan and complete checkout
          with the same email you sign in with — access unlocks right away.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
        <Link
          href="~/pricing"
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View plans
        </Link>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          {isFetching ? "Checking..." : "I've subscribed — check again"}
        </button>
        <button
          onClick={logout}
          className="text-muted-foreground text-xs hover:text-foreground transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (user && !user.onboardedAt && location !== "/chat") {
    return <Redirect to="/chat" />;
  }
  return <>{children}</>;
}

function AppRouter() {
  return (
    <AppLayout>
      <OnboardingGate>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/morning" component={Morning} />
          <Route path="/scans" component={Scans} />
          <Route path="/evening" component={Evening} />
          <Route path="/habits" component={Habits} />
          <Route path="/medications" component={Medications} />
          <Route path="/reports" component={Reports} />
          <Route path="/profile" component={Profile} />
          <Route path="/reminders" component={Reminders} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/chat" component={Chat} />
          <Route path="/archive" component={Archive} />
          <Route component={NotFound} />
        </Switch>
      </OnboardingGate>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/">
                <PublicLayout>
                  <Landing />
                </PublicLayout>
              </Route>
              <Route path="/about">
                <PublicLayout>
                  <About />
                </PublicLayout>
              </Route>
              <Route path="/science">
                <PublicLayout>
                  <Science />
                </PublicLayout>
              </Route>
              <Route path="/pricing">
                <PublicLayout>
                  <Pricing />
                </PublicLayout>
              </Route>
              <Route path="/payment-success">
                <PublicLayout>
                  <PaymentSuccess />
                </PublicLayout>
              </Route>
              <Route path="/app" nest>
                <AuthGate>
                  <SubscriptionGate>
                    <AppRouter />
                  </SubscriptionGate>
                </AuthGate>
              </Route>
              <Route>
                <PublicLayout>
                  <NotFound />
                </PublicLayout>
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

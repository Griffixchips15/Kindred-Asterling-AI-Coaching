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
import CalendarPage from "@/pages/calendar";
import Chat from "@/pages/chat";
import Archive from "@/pages/archive";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetSubscriptionStatus, getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";
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
      <div className="flex h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center">
        <div className="flex flex-col items-center">
          <img
            src={logoPoster}
            alt="Kindred Asterling — AI Coaching"
            className="w-60 max-w-[78vw] rounded-2xl shadow-2xl ring-1 ring-border/40"
          />
          <p className="mt-5 text-muted-foreground text-sm">Your personal daily wellness companion</p>
        </div>
        <button
          onClick={login}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Log in to continue
        </button>
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

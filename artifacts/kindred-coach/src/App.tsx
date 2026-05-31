import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";
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

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (user && !user.onboardedAt && location !== "/chat") {
    return <Redirect to="/chat" />;
  }
  return <>{children}</>;
}

function Router() {
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
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ClerkProvider,
  RedirectToTasks,
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useAuth,
  useSession,
} from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
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
import Reminders from "@/pages/reminders";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/public/landing";
import About from "@/pages/public/about";
import Science from "@/pages/public/science";
import Pricing from "@/pages/public/pricing";
import PaymentSuccess from "@/pages/public/payment-success";
import Login from "@/pages/public/login";
import Account from "@/pages/account";
import { ThemeProvider } from "@/hooks/use-theme";
import {
  AIUseDisclosure,
  CookieNotice,
  HealthDisclaimer,
  MarketingConsent,
  PrivacyPolicy,
  TermsAndConditions,
} from "@/pages/public/legal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Wires Clerk's session JWT into the API client so every /api request carries
// `Authorization: Bearer <token>` so the API can authenticate the user.
const AuthTokenReadyContext = createContext(false);

function AuthTokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [tokenBridgeReady, setTokenBridgeReady] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setTokenBridgeReady(true);

    return () => {
      setAuthTokenGetter(null);
      setTokenBridgeReady(false);
    };
  }, [getToken]);

  return (
    <AuthTokenReadyContext.Provider value={isLoaded && tokenBridgeReady}>
      {children}
    </AuthTokenReadyContext.Provider>
  );
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
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function PrivateRoutes() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const sessionStatus = session?.status;
  const tokenBridgeReady = useContext(AuthTokenReadyContext);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && sessionStatus !== "pending" && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, sessionStatus, setLocation]);

  if (sessionStatus === "pending") return <RedirectToTasks />;

  // React Query starts requests as soon as its consumers mount. Keep protected
  // pages unmounted until the shared API client can attach Clerk's bearer token;
  // public pages remain independent from Clerk startup latency.
  if (!isLoaded || !isSessionLoaded || !isSignedIn || !tokenBridgeReady) {
    return null;
  }

  return (
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
        <Route path="/account" component={Account} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/chat" component={Chat} />
        <Route path="/archive" component={Archive} />
        <Route path="/reminders" component={Reminders} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function SessionTaskShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </main>
  );
}

function ChooseOrganizationTask() {
  return (
    <SessionTaskShell>
      <TaskChooseOrganization redirectUrlComplete="/app" />
    </SessionTaskShell>
  );
}

function ResetPasswordTask() {
  return (
    <SessionTaskShell>
      <TaskResetPassword redirectUrlComplete="/app" />
    </SessionTaskShell>
  );
}

function SetupMfaTask() {
  return (
    <SessionTaskShell>
      <TaskSetupMFA redirectUrlComplete="/app" />
    </SessionTaskShell>
  );
}

// Legal pages are fully static and require no authentication context.
// Rendering them outside ClerkProvider prevents Clerk JS from being fetched
// on these routes, making them resilient to Clerk CDN failures.
const LEGAL_ROUTES: Record<string, () => ReactElement> = {
  "/legal/privacy": PrivacyPolicy,
  "/legal/terms": TermsAndConditions,
  "/legal/health-disclaimer": HealthDisclaimer,
  "/legal/ai-disclosure": AIUseDisclosure,
  "/legal/cookies": CookieNotice,
  "/legal/marketing-consent": MarketingConsent,
};

function LegalShell() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PublicLayout>
            <Switch>
              {Object.entries(LEGAL_ROUTES).map(([path, Component]) => (
                <Route key={path} path={path} component={Component} />
              ))}
            </Switch>
          </PublicLayout>
          <Toaster />
        </WouterRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  // Serve legal pages without loading Clerk at all.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname;
  const pathWithoutBase = base ? pathname.replace(base, "") || "/" : pathname;
  if (Object.keys(LEGAL_ROUTES).some((r) => pathWithoutBase === r)) {
    return <LegalShell />;
  }

  if (!clerkPubKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">
          VITE_CLERK_PUBLISHABLE_KEY is not configured.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      taskUrls={{
        "choose-organization": "/app/session-tasks/choose-organization",
        "reset-password": "/app/session-tasks/reset-password",
        "setup-mfa": "/app/session-tasks/setup-mfa",
      }}
    >
      <AuthTokenBridge>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TooltipProvider>
              <WouterRouter base={base}>
                <Switch>
                  <Route path="/" component={PublicRoutes} />
                  <Route path="/about" component={PublicRoutes} />
                  <Route path="/science" component={PublicRoutes} />
                  <Route path="/pricing" component={PublicRoutes} />
                  <Route path="/payment-success" component={PublicRoutes} />
                  <Route path="/login" component={PublicRoutes} />
                  <Route
                    path="/app/session-tasks/choose-organization"
                    component={ChooseOrganizationTask}
                  />
                  <Route
                    path="/app/session-tasks/reset-password"
                    component={ResetPasswordTask}
                  />
                  <Route
                    path="/app/session-tasks/setup-mfa"
                    component={SetupMfaTask}
                  />
                  <Route path="/app" nest component={PrivateRoutes} />
                  <Route component={NotFound} />
                </Switch>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </AuthTokenBridge>
    </ClerkProvider>
  );
}

export default App;

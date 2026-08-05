import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
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
import { ThemeProvider } from "@/hooks/use-theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) return null;

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
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/chat" component={Chat} />
        <Route path="/archive" component={Archive} />
        <Route path="/reminders" component={Reminders} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
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
    <ClerkProvider publishableKey={clerkPubKey}>
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
                <Route path="/app" nest component={PrivateRoutes} />
                <Route component={NotFound} />
              </Switch>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;

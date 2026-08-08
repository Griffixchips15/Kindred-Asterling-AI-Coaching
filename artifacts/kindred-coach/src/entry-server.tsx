import { renderToString } from "react-dom/server";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { Router } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import Landing from "@/pages/public/landing";
import About from "@/pages/public/about";
import Science from "@/pages/public/science";
import Pricing from "@/pages/public/pricing";
import PaymentSuccess from "@/pages/public/payment-success";

/**
 * Custom SSR-safe location hook for Wouter.
 *
 * Wouter's built-in `memoryLocation` uses `useSyncExternalStore`, which in
 * React 19 requires a `getServerSnapshot` argument. Since wouter doesn't
 * supply one, React 19's server renderer throws. This hook uses `useState`
 * instead — which is SSR-safe — and returns a static, no-op location object
 * that is enough to render page content without client-side navigation.
 */
function createSsrLocationHook(path: string) {
  function useSsrLocation(): [string, (to: string) => void] {
    const [location] = useState(path);
    return [location, () => {}];
  }

  useSsrLocation.searchHook = () => {
    const [search] = useState("");
    return search;
  };

  return useSsrLocation;
}

function getPageContent(path: string) {
  switch (path) {
    case "/":
      return <Landing />;
    case "/about":
      return <About />;
    case "/science":
      return <Science />;
    case "/pricing":
      return <Pricing />;
    case "/payment-success":
      return <PaymentSuccess />;
    default:
      return null;
  }
}

export function render(url: string): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const hook = createSsrLocationHook(url);
  const pageContent = getPageContent(url);
  if (!pageContent) return "";

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <ClerkProvider
        publishableKey={
          import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"
        }
      >
        <Router hook={hook}>
          <PublicLayout>{pageContent}</PublicLayout>
        </Router>
      </ClerkProvider>
    </QueryClientProvider>,
  );
}

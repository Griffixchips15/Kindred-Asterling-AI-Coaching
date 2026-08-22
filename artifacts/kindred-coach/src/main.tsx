import "./instrument";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <main role="alert" className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3">Please refresh the page and try again.</p>
      </main>
    }
  >
    <App />
  </Sentry.ErrorBoundary>,
);

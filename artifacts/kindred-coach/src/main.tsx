import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/app-error-boundary";
import { canonicalPathname } from "./lib/routing";
import "./index.css";

const pathname = canonicalPathname(window.location.pathname);
if (pathname !== window.location.pathname) {
  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${window.location.search}${window.location.hash}`,
  );
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

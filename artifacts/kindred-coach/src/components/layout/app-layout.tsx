import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <AppSidebar />
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-2xl mx-auto p-4 md:p-8 min-h-full">{children}</div>
      </main>
    </div>
  );
}

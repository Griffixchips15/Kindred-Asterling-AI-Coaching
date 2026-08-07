import { UserProfile } from "@clerk/clerk-react";

export default function AccountPage() {
  return (
    <div className="pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-serif text-primary tracking-tight">Account security</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage sign-in methods, including an authenticator app or phone verification.
        </p>
      </header>
      <UserProfile routing="hash" />
    </div>
  );
}

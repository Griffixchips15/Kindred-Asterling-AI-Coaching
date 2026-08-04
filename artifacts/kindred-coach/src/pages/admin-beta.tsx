import { FormEvent, useCallback, useEffect, useState } from "react";
import { Search, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BetaUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface BetaGrant {
  id: string;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export default function AdminBeta() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<BetaUser[]>([]);
  const [grants, setGrants] = useState<BetaGrant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadGrants = useCallback(async () => {
    const data = await api<{ grants: BetaGrant[] }>("/api/admin/beta/grants");
    setGrants(data.grants);
  }, []);

  useEffect(() => {
    loadGrants().catch((error: Error) => setMessage(error.message));
  }, [loadGrants]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (query.trim().length < 2) {
      setUsers([]);
      return;
    }
    try {
      const data = await api<{ users: BetaUser[] }>(
        `/api/admin/users?q=${encodeURIComponent(query.trim())}`,
      );
      setUsers(data.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed");
    }
  }

  async function grant(userId: string) {
    setBusyUserId(userId);
    setMessage(null);
    try {
      await api("/api/admin/beta/grant", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setMessage("Beta access granted.");
      await loadGrants();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Grant failed");
    } finally {
      setBusyUserId(null);
    }
  }

  async function revoke(userId: string) {
    setBusyUserId(userId);
    setMessage(null);
    try {
      await api("/api/admin/beta/revoke", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setMessage("Beta access revoked.");
      await loadGrants();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revoke failed");
    } finally {
      setBusyUserId(null);
    }
  }

  const activeUserIds = new Set(
    grants
      .filter(
        (grant) =>
          !grant.revokedAt &&
          (!grant.expiresAt || new Date(grant.expiresAt) > new Date()),
      )
      .map((grant) => grant.userId),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Beta access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant access only after the tester has verified their email.
        </p>
      </header>

      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email"
          type="search"
        />
        <Button type="submit" aria-label="Search users">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {users.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium">Search results</h2>
          <div className="divide-y rounded-md border">
            {users.map((user) => {
              const active = activeUserIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {user.email ?? "No email"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.emailVerifiedAt ? "Verified" : "Not verified"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? "outline" : "default"}
                    disabled={
                      busyUserId === user.id ||
                      (!active && !user.emailVerifiedAt)
                    }
                    onClick={() => (active ? revoke(user.id) : grant(user.id))}
                  >
                    {active ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                    {active ? "Revoke" : "Grant"}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium">Grant history</h2>
        <div className="divide-y rounded-md border">
          {grants.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              No beta grants yet.
            </p>
          ) : (
            grants.map((grant) => (
              <div key={grant.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="truncate text-sm font-medium">
                    {grant.email ?? grant.userId}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {grant.revokedAt
                      ? "Revoked"
                      : grant.expiresAt && new Date(grant.expiresAt) <= new Date()
                        ? "Expired"
                        : "Active"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Granted {new Date(grant.grantedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

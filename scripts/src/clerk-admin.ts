/**
 * Read-only inspection of the Clerk instance via the Backend API.
 *
 * Usage: CLERK_SECRET_KEY=sk_... pnpm --filter @workspace/scripts run clerk:admin <command> [options]
 */

const API_BASE = process.env.CLERK_API_URL ?? "https://api.clerk.com/v1";

type Json = Record<string, unknown>;

class ClerkApiError extends Error {}

async function api(path: string, secretKey: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ClerkApiError(`${path}: non-JSON response (${response.status}): ${text.slice(0, 200)}`);
    }
  }
  if (!response.ok) {
    const errors = (body as { errors?: { long_message?: string; message?: string }[] } | null)?.errors;
    const detail = errors?.map((e) => e.long_message ?? e.message).join("; ") ?? response.statusText;
    throw new ClerkApiError(`${path}: ${response.status} ${detail}`);
  }
  return body;
}

/** Clerk returns either a bare array or a `{ data, total_count }` envelope depending on the endpoint. */
function items(payload: unknown): Json[] {
  if (Array.isArray(payload)) return payload as Json[];
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Json[]) : [];
}

function totalCount(payload: unknown, fallback: number): number {
  const count = (payload as { total_count?: unknown } | null)?.total_count;
  return typeof count === "number" ? count : fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function timestamp(value: unknown): string {
  return typeof value === "number" ? new Date(value).toISOString() : "unknown";
}

function describeUser(user: Json): string {
  const emails = items(user["email_addresses"]).map((e) => str(e["email_address"]) ?? "");
  const name = [str(user["first_name"]), str(user["last_name"])].filter(Boolean).join(" ") || "(no name)";
  const flags = [
    user["two_factor_enabled"] === true ? "2fa" : null,
    user["banned"] === true ? "banned" : null,
    user["locked"] === true ? "locked" : null,
  ].filter(Boolean);
  const suffix = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
  return `${str(user["id"])}  ${name}  <${emails.join(", ")}>  last_sign_in=${timestamp(user["last_sign_in_at"])}${suffix}`;
}

function describeOrg(org: Json): string {
  const members = org["members_count"];
  const memberSuffix = typeof members === "number" ? `  members=${members}` : "";
  return `${str(org["id"])}  ${str(org["name"])}  slug=${str(org["slug"])}${memberSuffix}  max_seats=${String(org["max_allowed_memberships"])}`;
}

function describeSession(session: Json): string {
  const activity = (session["latest_activity"] ?? {}) as Json;
  const where = [str(activity["city"]), str(activity["country"])].filter(Boolean).join(", ") || "unknown location";
  const browser = [str(activity["browser_name"]), str(activity["browser_version"])].filter(Boolean).join(" ");
  return `${str(session["id"])}  ${str(session["status"])}  ${browser || "unknown browser"}  ${where}  last_active=${timestamp(session["last_active_at"])}`;
}

async function overview(secretKey: string): Promise<void> {
  const [instance, userCount, users, orgs, invitations, waitlist] = await Promise.all([
    api("/instance", secretKey),
    api("/users/count", secretKey),
    api("/users?limit=5&order_by=-created_at", secretKey),
    api("/organizations?limit=10", secretKey),
    api("/invitations?limit=100", secretKey),
    api("/waitlist_entries?limit=1", secretKey),
  ]);

  const instanceRecord = instance as Json;
  console.log(`Instance ${str(instanceRecord["id"])} (${str(instanceRecord["environment_type"])})`);
  console.log(`Users: ${String((userCount as Json)["total_count"])}`);
  for (const user of items(users)) console.log(`  ${describeUser(user)}`);

  const orgList = items(orgs);
  console.log(`Organizations: ${totalCount(orgs, orgList.length)}`);
  for (const org of orgList) console.log(`  ${describeOrg(org)}`);

  const invitationList = items(invitations);
  const pending = invitationList.filter((i) => i["status"] === "pending").length;
  console.log(`Invitations: ${invitationList.length} (${pending} pending)`);
  console.log(`Waitlist entries: ${totalCount(waitlist, items(waitlist).length)}`);
}

async function listUsers(secretKey: string, limit: number): Promise<void> {
  for (const user of items(await api(`/users?limit=${limit}&order_by=-created_at`, secretKey))) {
    console.log(describeUser(user));
  }
}

async function listOrgs(secretKey: string, limit: number): Promise<void> {
  for (const org of items(await api(`/organizations?limit=${limit}`, secretKey))) {
    console.log(describeOrg(org));
    for (const membership of items(await api(`/organizations/${str(org["id"])}/memberships?limit=${limit}`, secretKey))) {
      const publicData = (membership["public_user_data"] ?? {}) as Json;
      const name = [str(publicData["first_name"]), str(publicData["last_name"])].filter(Boolean).join(" ");
      console.log(`  ${str(membership["role"])}  ${name || str(publicData["user_id"]) || "(unknown member)"}`);
    }
  }
}

/** The Clerk API rejects session listing without a user or client filter, so a user id is required. */
async function listSessions(secretKey: string, userId: string | undefined, limit: number): Promise<void> {
  const ids = userId !== undefined ? [userId] : items(await api("/users?limit=50", secretKey)).map((u) => str(u["id"]));
  for (const id of ids) {
    if (id === undefined) continue;
    console.log(id);
    for (const session of items(await api(`/sessions?user_id=${id}&limit=${limit}`, secretKey))) {
      console.log(`  ${describeSession(session)}`);
    }
  }
}

async function listInvitations(secretKey: string, limit: number): Promise<void> {
  for (const invitation of items(await api(`/invitations?limit=${limit}`, secretKey))) {
    console.log(`${str(invitation["id"])}  ${str(invitation["email_address"])}  ${str(invitation["status"])}  created=${timestamp(invitation["created_at"])}`);
  }
}

async function listDomains(secretKey: string): Promise<void> {
  for (const domain of items(await api("/domains", secretKey))) {
    console.log(`${str(domain["name"])}  frontend=${str(domain["frontend_api_url"])}  accounts=${str(domain["accounts_portal_url"])}`);
    for (const target of items(domain["dns_targets"])) {
      console.log(`  ${str(target["record_type"])}  ${str(target["host"])} -> ${str(target["value"])}`);
    }
  }
}

const USAGE = `Usage: clerk-admin <command> [--limit N] [--user user_xxx]

Commands:
  overview      Instance summary: user count, recent users, orgs, invitations, waitlist (default)
  users         List users, newest first
  orgs          List organizations with their memberships
  sessions      List sessions for --user, or for every user when omitted
  invitations   List invitations and their status
  domains       List domains with required DNS records
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (secretKey === undefined || secretKey === "") {
    console.error("CLERK_SECRET_KEY is not set");
    return 1;
  }

  const command = argv.find((arg) => !arg.startsWith("--")) ?? "overview";
  const limitArg = argv[argv.indexOf("--limit") + 1];
  const limit = argv.includes("--limit") && limitArg !== undefined ? Number.parseInt(limitArg, 10) : 10;
  const userId = argv.includes("--user") ? argv[argv.indexOf("--user") + 1] : undefined;

  if (Number.isNaN(limit) || limit < 1) {
    console.error("--limit must be a positive integer");
    return 1;
  }

  try {
    switch (command) {
      case "overview":
        await overview(secretKey);
        return 0;
      case "users":
        await listUsers(secretKey, limit);
        return 0;
      case "orgs":
        await listOrgs(secretKey, limit);
        return 0;
      case "sessions":
        await listSessions(secretKey, userId, limit);
        return 0;
      case "invitations":
        await listInvitations(secretKey, limit);
        return 0;
      case "domains":
        await listDomains(secretKey);
        return 0;
      default:
        console.error(`Unknown command "${command}"\n\n${USAGE}`);
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

process.exitCode = await main();

export {};

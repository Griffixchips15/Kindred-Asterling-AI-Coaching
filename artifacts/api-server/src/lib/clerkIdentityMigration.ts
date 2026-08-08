export interface LegacyUser {
  id: string;
  email: string | null;
  clerkUserId: string | null;
}

export interface ClerkMigrationUser {
  id: string;
  primaryEmail: string | null;
}

export interface IdentityMapping {
  userId: string;
  clerkUserId: string;
}

export interface AmbiguousIdentity {
  clerkUserId: string;
  primaryEmail: string | null;
  candidateUserIds: string[];
}

const normalizeEmail = (email: string | null) =>
  email?.trim().toLowerCase() ?? null;

/** Builds a migration plan without ever silently selecting an email match. */
export function planLegacyIdentityMigration(
  legacyUsers: LegacyUser[],
  clerkUsers: ClerkMigrationUser[],
) {
  const mappings: IdentityMapping[] = [];
  const ambiguous: AmbiguousIdentity[] = [];
  const claimed = new Set<string>();

  for (const clerkUser of clerkUsers) {
    const email = normalizeEmail(clerkUser.primaryEmail);
    const explicitCandidates = legacyUsers.filter(
      (user) => user.clerkUserId === clerkUser.id || user.id === clerkUser.id,
    );
    // Once an explicit/old-ID relationship exists, changed emails must not
    // redirect the identity to a different application account.
    const candidates =
      explicitCandidates.length > 0
        ? explicitCandidates
        : legacyUsers.filter(
            (user) => email !== null && normalizeEmail(user.email) === email,
          );
    const candidateIds = [...new Set(candidates.map(({ id }) => id))];

    if (candidateIds.length !== 1 || claimed.has(candidateIds[0])) {
      ambiguous.push({
        clerkUserId: clerkUser.id,
        primaryEmail: clerkUser.primaryEmail,
        candidateUserIds: candidateIds,
      });
      continue;
    }

    mappings.push({ userId: candidateIds[0], clerkUserId: clerkUser.id });
    claimed.add(candidateIds[0]);
  }

  return { mappings, ambiguous };
}

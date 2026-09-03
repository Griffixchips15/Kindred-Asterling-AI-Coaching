import { randomUUID } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "@workspace/db";

export interface ClerkIdentityData {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string } | null;
  }>;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

export function primaryEmail(identity: ClerkIdentityData) {
  const address = identity.emailAddresses?.find(
    ({ id }) => id === identity.primaryEmailAddressId,
  );
  return {
    email: address?.emailAddress ?? identity.email ?? null,
    emailVerified:
      address?.verification?.status === "verified" ||
      identity.emailVerified === true,
  };
}

const selectedUser = {
  id: usersTable.id,
  email: usersTable.email,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  profileImageUrl: usersTable.profileImageUrl,
  emailVerifiedAt: usersTable.emailVerifiedAt,
};

/** Idempotently creates or updates the explicit Clerk-to-application mapping. */
export async function syncClerkIdentity(identity: ClerkIdentityData) {
  const { email, emailVerified } = primaryEmail(identity);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(usersTable)
      .values({
        id: randomUUID(),
        clerkUserId: identity.id,
        email,
        firstName: identity.firstName ?? null,
        lastName: identity.lastName ?? null,
        profileImageUrl: identity.imageUrl ?? null,
        emailVerifiedAt: emailVerified ? now : null,
        clerkDeletedAt: null,
      })
      .onConflictDoUpdate({
        target: usersTable.clerkUserId,
        set: {
          email,
          firstName: identity.firstName ?? null,
          lastName: identity.lastName ?? null,
          profileImageUrl: identity.imageUrl ?? null,
          emailVerifiedAt: emailVerified ? now : null,
          clerkDeletedAt: null,
          updatedAt: now,
        },
      })
      .returning(selectedUser);
    return user;
  });
}

/** Preserve application data and the mapping while marking Clerk deletion. */
export async function markClerkIdentityDeleted(clerkUserId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ clerkDeletedAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.clerkUserId, clerkUserId));
  });
}

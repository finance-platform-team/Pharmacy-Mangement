import { useCallback, useEffect, useState } from "react";
import { getContext } from "@microsoft/power-apps/app";
import { SystemusersService } from "../api/dataverse";

interface CurrentUser {
  systemUserId: string;       // Dataverse systemuserid - use this for *by@odata.bind fields
  fullName: string;
  userPrincipalName: string;
  loading: boolean;
  error: string | null;
  /** Look the user up again after a failure. */
  retry: () => void;
}

interface ResolvedUser {
  systemUserId: string;
  fullName: string;
  userPrincipalName: string;
}

// The user never changes during a session, but three components call this hook
// (Claims, ePrescriptions, visit actions) — share ONE lookup between them.
let userPromise: Promise<ResolvedUser> | null = null;

// A failed query (throttling, timeout, connection not ready yet) must not look like
// "user not found" — retry it a few times, and report the real error if it keeps failing.
const LOOKUP_RETRY_DELAYS_MS = [600, 1500];

async function lookupSystemUser(azureObjectId: string) {
  for (let attempt = 0; ; attempt++) {
    let failure: string;
    try {
      const result = await SystemusersService.getAll({
        select: ["systemuserid"],
        filter: `azureactivedirectoryobjectid eq '${azureObjectId}'`,
        top: 1,
      });
      if (result.success) return result;
      const err = result.error as { message?: string } | string | undefined;
      failure = String((typeof err === "object" ? err?.message : err) ?? "systemusers query failed");
    } catch (err) {
      failure = String(err);
    }
    const delay = LOOKUP_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      throw new Error(`Could not look up your user record (${failure}). Please retry.`);
    }
    console.warn(`[Access] systemusers lookup failed, retrying: ${failure}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function resolveCurrentUser(): Promise<ResolvedUser> {
  if (!userPromise) {
    userPromise = (async () => {
      const ctx = await getContext();
      const azureObjectId = ctx.user?.objectId;
      if (!azureObjectId) {
        throw new Error("getContext() returned no user.objectId");
      }
      const result = await lookupSystemUser(azureObjectId);
      const match = result.data?.[0];
      if (!match) {
        // Shows up as the "Could not check your access" screen — say who and what to ask for.
        const who = ctx.user?.userPrincipalName || ctx.user?.fullName || azureObjectId;
        throw new Error(
          `Your account (${who}) was not found in the pharmacy data environment. ` +
            "Ask an administrator to add you to it and give you a Pharmacy role (e.g. Pharmacy - Pharmacist).",
        );
      }
      return {
        systemUserId: match.systemuserid,
        fullName: ctx.user?.fullName ?? "",
        userPrincipalName: ctx.user?.userPrincipalName ?? "",
      };
    })();
    // A failed lookup must be retryable, not cached forever.
    userPromise.catch(() => {
      userPromise = null;
    });
  }
  return userPromise;
}

/**
 * Resolves the logged-in user's Dataverse systemuserid.
 *
 * getContext() only gives us the Azure AD objectId, which is NOT the same
 * GUID as systemuserid. We join azureactivedirectoryobjectid -> systemuserid
 * via a lookup on the systemusers table. This mirrors what getCurrentUserId()
 * (Xrm.Utility.getGlobalContext()) used to give us directly in the old file.
 */
export function useCurrentUser(): CurrentUser {
  const [systemUserId, setSystemUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [userPrincipalName, setUserPrincipalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const user = await resolveCurrentUser();
        if (cancelled) return;
        setSystemUserId(user.systemUserId);
        setFullName(user.fullName);
        setUserPrincipalName(user.userPrincipalName);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { systemUserId, fullName, userPrincipalName, loading, error, retry };
}
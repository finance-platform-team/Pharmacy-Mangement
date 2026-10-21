import { useEffect, useState } from "react";
import { getContext } from "@microsoft/power-apps/app";
import { SystemusersService } from "../api/dataverse";

interface CurrentUser {
  systemUserId: string;       // Dataverse systemuserid - use this for *by@odata.bind fields
  fullName: string;
  userPrincipalName: string;
  loading: boolean;
  error: string | null;
}

interface ResolvedUser {
  systemUserId: string;
  fullName: string;
  userPrincipalName: string;
}

// The user never changes during a session, but three components call this hook
// (Claims, ePrescriptions, visit actions) — share ONE lookup between them.
let userPromise: Promise<ResolvedUser> | null = null;

function resolveCurrentUser(): Promise<ResolvedUser> {
  if (!userPromise) {
    userPromise = (async () => {
      const ctx = await getContext();
      const azureObjectId = ctx.user?.objectId;
      if (!azureObjectId) {
        throw new Error("getContext() returned no user.objectId");
      }
      const result = await SystemusersService.getAll({
        select: ["systemuserid"],
        filter: `azureactivedirectoryobjectid eq '${azureObjectId}'`,
        top: 1,
      });
      const match = result.data?.[0];
      if (!match) {
        throw new Error("No systemuser found matching this Azure AD objectId");
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
  }, []);

  return { systemUserId, fullName, userPrincipalName, loading, error };
}
import { useEffect, useState } from "react";
import { getContext } from "@microsoft/power-apps/app";
import { SystemusersService } from "../generated/services/SystemusersService";

interface CurrentUser {
  systemUserId: string;       // Dataverse systemuserid - use this for *by@odata.bind fields
  fullName: string;
  userPrincipalName: string;
  loading: boolean;
  error: string | null;
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

        if (cancelled) return;

        const match = result.data?.[0];
        if (!match) {
          throw new Error(
            "No systemuser found matching this Azure AD objectId",
          );
        }

        setSystemUserId(match.systemuserid);
        setFullName(ctx.user?.fullName ?? "");
        setUserPrincipalName(ctx.user?.userPrincipalName ?? "");
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
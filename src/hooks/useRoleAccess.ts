import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { getAllowedRolesOf } from "../api/rolesApi";

interface RoleAccess {
  /** Still working out who the user is / which roles they hold. */
  loading: boolean;
  /** True when the user holds at least one of the allowed roles. */
  allowed: boolean;
  /** The allowed roles the user holds (for the log / the denied screen). */
  roles: string[];
  fullName: string;
  /** Set when the user or role lookup itself failed — access is NOT granted then. */
  error: string | null;
  retry: () => void;
}

/**
 * Whether the signed-in user may use the app: they need one of ALLOWED_ROLES
 * (see rolesApi.ts). If the lookup fails the answer is "no" with the error, so a
 * glitch never lets someone in by accident.
 */
export function useRoleAccess(): RoleAccess {
  const user = useCurrentUser();
  const [roles, setRoles] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const { systemUserId, loading: userLoading, error: userError, retry: retryUser } = user;
  // The user could not be identified at all: nothing to look roles up for.
  const noUser = !userLoading && !systemUserId;

  useEffect(() => {
    if (!systemUserId) return;
    let cancelled = false;
    getAllowedRolesOf(systemUserId)
      .then((found) => {
        if (cancelled) return;
        console.info("[Access] allowed roles held:", found);
        setRoles(found);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Access] role lookup failed", err);
        setLookupError(String(err));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [systemUserId, attempt]);

  const retry = useCallback(() => {
    setLookupError(null);
    setChecking(true);
    setAttempt((n) => n + 1);
    // The user lookup itself failed: there is no systemUserId to re-check roles for yet.
    if (!systemUserId) retryUser();
  }, [systemUserId, retryUser]);

  return {
    loading: userLoading || (!noUser && checking),
    allowed: roles.length > 0,
    roles,
    fullName: user.fullName,
    error: noUser ? (userError ?? "Could not identify the signed-in user") : lookupError,
    retry,
  };
}

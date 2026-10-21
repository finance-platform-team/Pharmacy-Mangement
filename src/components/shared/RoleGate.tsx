import type { ReactNode } from "react";
import { useRoleAccess } from "../../hooks/useRoleAccess";
import { ALLOWED_ROLES } from "../../api/rolesApi";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Spinner from "../ui/Spinner";
import "../ep/EpList.css";

/**
 * Lets the app through only to users who hold one of ALLOWED_ROLES; anyone who
 * does sees everything. Nothing under it is mounted (so nothing is fetched)
 * until the check passes.
 */
export default function RoleGate({ children }: { children: ReactNode }) {
  const { loading, allowed, fullName, error, retry } = useRoleAccess();

  if (loading) return <Spinner show withCard text="Checking your access…" />;
  if (allowed) return <>{children}</>;

  return (
    <div className="ep-empty" style={{ marginTop: 80 }}>
      <Icon name={error ? "exclamation-triangle" : "shield-lock"} />
      {error ? (
        <>
          <p>Could not check your access</p>
          <p>{error}</p>
          <Button variant="primary" icon="bi-arrow-clockwise" onClick={retry}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <p>You don&apos;t have access to this app</p>
          <p>
            {fullName ? `${fullName}, ` : ""}you need one of these roles: {ALLOWED_ROLES.join(", ")}. Please ask your
            administrator.
          </p>
        </>
      )}
    </div>
  );
}

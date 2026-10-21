import { useMemo, useState, type ReactNode } from "react";
import { AutoRefreshContext } from "./AutoRefreshContext";

/** On by default — every session starts with auto refresh running (the header toggle can still pause it). */
export function AutoRefreshProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const value = useMemo(() => ({ enabled, setEnabled }), [enabled]);
  return <AutoRefreshContext.Provider value={value}>{children}</AutoRefreshContext.Provider>;
}

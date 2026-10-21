import { createContext, useContext } from "react";

export interface AutoRefreshContextValue {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

export const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(null);

export function useAutoRefresh(): AutoRefreshContextValue {
  const ctx = useContext(AutoRefreshContext);
  if (!ctx) {
    throw new Error("useAutoRefresh must be used inside AutoRefreshProvider");
  }
  return ctx;
}

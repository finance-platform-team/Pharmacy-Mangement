import type { ReactNode } from "react";
import { useBusinessUnit } from "./hooks/useBusinessUnit";
import { BusinessUnitContext } from "./BusinessUnitContext";

export function BusinessUnitProvider({ children }: { children: ReactNode }) {
  const value = useBusinessUnit();
  return (
    <BusinessUnitContext.Provider value={value}>
      {children}
    </BusinessUnitContext.Provider>
  );
}

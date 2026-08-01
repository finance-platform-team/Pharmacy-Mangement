import { createContext, useContext } from "react";
import type { BusinessUnit } from "./hooks/useBusinessUnit";

export interface BusinessUnitContextValue {
  units: BusinessUnit[];
  loading: boolean;
  selectedBuId: string;
  selectedBuName: string;
  setBu: (id: string, name: string) => void;
  hasSelectedBu: boolean;
  ARC_GUID: string | null;
  AAC_GUID: string | null;
  SMH_GUID: string | null;
}

export const BusinessUnitContext = createContext<BusinessUnitContextValue | null>(null);

export function useBusinessUnitContext(): BusinessUnitContextValue {
  const ctx = useContext(BusinessUnitContext);
  if (!ctx) {
    throw new Error("useBusinessUnitContext must be used inside BusinessUnitProvider");
  }
  return ctx;
}
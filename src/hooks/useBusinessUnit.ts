import { useEffect, useState, useCallback } from "react";
import { BusinessunitsService } from "../generated/services/BusinessunitsService";

export interface BusinessUnit {
  id: string;
  name: string;
}

const KNOWN_BU_NAMES = ["AMH", "ARC", "AAC", "ASH", "SMH"];

const BU_ID_KEY = "pharmacy_bu_id";
const BU_NAME_KEY = "pharmacy_bu_name";

interface UseBusinessUnitResult {
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

/**
 * Fetches the known branch list (AMH/ARC/AAC/ASH/SMH) and tracks the
 * currently selected branch (persisted in localStorage, same keys as the
 * old file: pharmacy_bu_id / pharmacy_bu_name).
 *
 * NOTE (Phase 11 decision, differs from the original): the startup modal
 * that forces a branch choice will show only ONCE (not every app launch
 * like the old file) — `hasSelectedBu` tells the caller whether a branch
 * is already stored so it knows whether to show that modal at all.
 */
export function useBusinessUnit(): UseBusinessUnitResult {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuId, setSelectedBuId] = useState<string>(
    () => localStorage.getItem(BU_ID_KEY) ?? ""
  );
  const [selectedBuName, setSelectedBuName] = useState<string>(
    () => localStorage.getItem(BU_NAME_KEY) ?? ""
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const filter = KNOWN_BU_NAMES.map((n) => `name eq '${n}'`).join(" or ");
        const result = await BusinessunitsService.getAll({
          select: ["businessunitid", "name"],
          filter,
        });
        if (cancelled) return;
        const list = (result.data ?? []).map((bu) => ({
          id: bu.businessunitid,
          name: bu.name,
        }));
        setUnits(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setBu = useCallback((id: string, name: string) => {
    localStorage.setItem(BU_ID_KEY, id);
    localStorage.setItem(BU_NAME_KEY, name);
    setSelectedBuId(id);
    setSelectedBuName(name);
  }, []);

  const findGuid = (name: string): string | null =>
    units.find((u) => u.name.toLowerCase() === name.toLowerCase())?.id ?? null;

  return {
    units,
    loading,
    selectedBuId,
    selectedBuName,
    setBu,
    hasSelectedBu: selectedBuId !== "",
    ARC_GUID: findGuid("ARC"),
    AAC_GUID: findGuid("AAC"),
    SMH_GUID: findGuid("SMH"),
  };
}
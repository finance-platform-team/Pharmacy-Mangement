import { useEffect, useState } from "react";
import { BusinessunitsService } from "../generated/services/BusinessunitsService";

export interface BusinessUnit {
  id: string;
  name: string;
}

const KNOWN_BU_NAMES = ["AMH", "ARC", "AAC", "ASH", "SMH"];

interface UseBusinessUnitResult {
  units: BusinessUnit[];
  loading: boolean;
}

/**
 * Fetches the known branch list for simple dropdowns (e.g. the Manual
 * Prescription form's Branch field). The app-wide BU selector/startup
 * modal/localStorage persistence from the old file is deferred to
 * Phase 11 — this hook only covers the "give me the list of branches"
 * part for now.
 */
export function useBusinessUnit(): UseBusinessUnitResult {
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { units, loading };
}
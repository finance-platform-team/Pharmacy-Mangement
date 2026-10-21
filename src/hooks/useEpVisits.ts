import { useCallback, useEffect, useRef, useState } from "react";
import type { Visit } from "../domain/types";
import { useBusinessUnitContext } from "../BusinessUnitContext";
import { searchEpByPhone, type EpSource } from "../api/medicationOlApi";

interface UseEpVisitsResult {
  /** Active ePrescriptions found in the SQL view for the last searched phone. */
  visits: Visit[];
  loading: boolean;
  error: string | null;
  /** Databases that could not be searched this time (others still returned results). */
  warnings: string[];
  /** True until every database has answered and the "already saved?" check is done (only drives the "Still searching…" note). */
  verifying: boolean;
  /** True until the Dataverse "already saved?" check is done — only this makes Draft/Cancel wait, not a slow database. */
  checking: boolean;
  /** True once a phone search has run (so the list can tell "no search yet" from "no results"). */
  searched: boolean;
  /** The phone number of the last search (kept here so it survives leaving/re-entering the list). */
  phone: string;
  /** Searches PA.medicationOL by patient phone (grouped by visit ID). */
  search: (phone: string) => void;
  /** Re-runs the last phone search quietly (no spinner) — use after an action on a single row. */
  refresh: () => Promise<void>;
  /** Drops a row from the list right away — for actions that move a visit out of the EP list (draft / cancel). */
  removeVisit: (id: string) => void;
  /** A view entry was just saved to Dataverse: point its row at the real record. */
  markSaved: (viewId: string, dvId: string) => void;
}

/**
 * Which DotCare database(s) to search for the selected branch: AMH → the AMH
 * server; All BUs → both servers; every other branch (ARC, AAC, ASH, SMH) →
 * the ANC server.
 */
function sourcesFor(selectedBuId: string, selectedBuName: string): EpSource[] {
  if (selectedBuId === "ALL") return ["ANC", "AMH"];
  return selectedBuName.toUpperCase() === "AMH" ? ["AMH"] : ["ANC"];
}

/**
 * Active ePrescriptions come from the SQL view PA.medicationOL, searched by
 * patient phone. Visits already saved to Dataverse (Drafted / Cancelled / …)
 * are hidden from this list.
 */
export function useEpVisits(): UseEpVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const { units, selectedBuId, selectedBuName } = useBusinessUnitContext();

  // The branch list is read through a ref and keyed by its ids: a new array
  // with the same branches must not restart a search.
  const unitsRef = useRef(units);
  useEffect(() => {
    unitsRef.current = units;
  }, [units]);
  const unitsKey = units.map((u) => u.id).join(",");

  const search = useCallback((p: string) => {
    setPhone(p.trim());
    setReloadToken((n) => n + 1);
  }, []);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const refresh = useCallback(() => refreshRef.current?.() ?? Promise.resolve(), []);
  const markSaved = useCallback((viewId: string, dvId: string) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, id: dvId, fromView: false } : v)),
    );
  }, []);

  const removeVisit = useCallback((id: string) => {
    setVisits((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // ── Active list: phone search against the SQL view ───────────────────
  useEffect(() => {
    if (!phone) {
      refreshRef.current = null;
      return;
    }
    let cancelled = false;

    async function load(silent: boolean) {
      if (!silent) {
        setLoading(true);
        setError(null);
        setWarnings([]);
      }
      setVerifying(true);
      setChecking(true);
      try {
        const sources = sourcesFor(selectedBuId, selectedBuName);

        // Show each database's results the moment they arrive (first paint
        // doesn't wait for the slower one); the final list replaces them.
        const found = await searchEpByPhone(phone, sources, unitsRef.current, {
          onPartial: (partial, verified) => {
            if (cancelled) return;
            // Draft/Cancel only need the "already saved?" answer, not the slowest database.
            setChecking(!verified);
            const list = partial;
            // One database answering "nothing" must not look like "no results"
            // while the other is still searching — only show what was found;
            // the empty state waits for the final answer below.
            if (list.length === 0) return;
            setVisits(list);
            setSearched(true);
            setLoading(false);
          },
          onSourceError: (_source, message) => {
            if (!cancelled) setWarnings((w) => (w.includes(message) ? w : [...w, message]));
          },
        });
        if (cancelled) return;
        setVisits(found);
        setSearched(true);
      } catch (err) {
        if (!cancelled && !silent) {
          setError(String(err));
          setVisits([]);
          setSearched(true);
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
          setChecking(false);
        }
        if (!cancelled && !silent) setLoading(false);
      }
    }

    refreshRef.current = () => load(true);
    void load(false);

    return () => {
      cancelled = true;
      refreshRef.current = null;
    };
  }, [phone, reloadToken, selectedBuId, selectedBuName, unitsKey]);

  return {
    visits,
    loading,
    error,
    searched,
    warnings,
    verifying,
    checking,
    phone,
    search,
    refresh,
    removeVisit,
    markSaved,
  };
}

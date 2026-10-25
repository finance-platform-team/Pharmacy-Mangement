import { useCallback, useEffect, useRef, useState } from "react";
import type { Visit } from "../domain/types";
import { useBusinessUnitContext } from "../BusinessUnitContext";
import { buildBuFilter } from "./useVisits";
import { fetchNoShowVisits, NO_SHOW_SEARCH_DAYS } from "../api/noShowApi";

interface UseNoShowVisitsResult {
  visits: Visit[];
  loading: boolean;
  error: string | null;
  /** The active search text ("" = no search yet: nothing is loaded or shown). */
  term: string;
  /** Days the search looks back. */
  days: number;
  /** Empty text ends the search and empties the list again. */
  search: (term: string) => void;
  reload: () => void;
  /** Drops a row right away — it left the No Show list (restored to Draft). */
  removeVisit: (id: string) => void;
}

/**
 * No Show visits (cancelled with reason "No Show") from Dataverse. Nothing is
 * loaded until a search term is entered; a search looks back `days` days.
 */
export function useNoShowVisits(): UseNoShowVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const { selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID } = useBusinessUnitContext();

  const search = useCallback((t: string) => setTerm(t.trim()), []);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  const removeVisit = useCallback(
    (id: string) => setVisits((prev) => prev.filter((v) => v.id !== id)),
    [],
  );

  const days = NO_SHOW_SEARCH_DAYS;

  // What the rows on screen were loaded for. A different search / branch must not
  // keep showing the previous rows while the new answer is on its way; the Refresh
  // button (same search) keeps them until the new rows arrive.
  const shownFor = useRef("");

  useEffect(() => {
    if (!term) return; // no search, no request
    let cancelled = false;
    const key = `${term}|${selectedBuId}`;
    async function load() {
      setLoading(true);
      setError(null);
      if (shownFor.current !== key) setVisits([]);
      try {
        const list = await fetchNoShowVisits({
          days,
          term,
          buFilter: buildBuFilter(selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID),
        });
        if (!cancelled) {
          setVisits(list);
          shownFor.current = key;
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setVisits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [term, days, reloadToken, selectedBuId, ARC_GUID, AAC_GUID, SMH_GUID]);

  // With no search nothing is shown, whatever an earlier search left in state.
  return {
    visits: term ? visits : [],
    loading: term ? loading : false,
    error: term ? error : null,
    term,
    days,
    search,
    reload,
    removeVisit,
  };
}

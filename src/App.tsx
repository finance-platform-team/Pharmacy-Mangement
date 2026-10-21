import { useState } from "react";
import ClaimsScreen from "./components/claims/ClaimsScreen";
import EpScreen from "./components/ep/EpScreen";
import { PrintProvider } from "./PrintProvider";
import { BusinessUnitProvider } from "./BusinessUnitProvider";
import BuStartupModal from "./components/shared/BuStartupModal";
import BuSelector from "./components/shared/BuSelector";
import AutoRefreshToggle from "./components/shared/AutoRefreshToggle";
import RoleGate from "./components/shared/RoleGate";
import { AutoRefreshProvider } from "./AutoRefreshProvider";
import "./App.css";
import "./styles/print.css";

// Bundled as a data URI: the Power Apps host blocks images from other domains.
import logoUrl from "./assets/andalusia-health-logo.png?inline";

type Tab = "claims" | "ep";

export default function App() {
  return (
    <RoleGate>
      <AppContent />
    </RoleGate>
  );
}

function AppContent() {
  const [tab, setTab] = useState<Tab>("ep");
  // Once a tab has been opened, keep it mounted (hidden via display, not
  // unmounted) so switching back doesn't re-run that screen's data fetch.
  const [visited, setVisited] = useState<Record<Tab, boolean>>({ ep: true, claims: false });

  function selectTab(next: Tab) {
    setTab(next);
    setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
  }

  return (
    <BusinessUnitProvider>
      <AutoRefreshProvider>
      <PrintProvider>
        <BuStartupModal />
        <header className="app-shell-header">
          <img src={logoUrl} alt="Andalusia Health" className="app-shell-logo" />
          <BuSelector />
          <AutoRefreshToggle />
          <nav className="main-tabs" role="tablist">
            <button
              type="button"
              className={`main-tab-btn ${tab === "ep" ? "active" : ""}`}
              aria-selected={tab === "ep"}
              onClick={() => selectTab("ep")}
            >
              ePrescriptions
            </button>
            <button
              type="button"
              className={`main-tab-btn ${tab === "claims" ? "active" : ""}`}
              aria-selected={tab === "claims"}
              onClick={() => selectTab("claims")}
            >
              Insurance Claims Queue
            </button>
          </nav>
        </header>

        <div className="app-shell">
          {/* A screen mounts on first visit and stays mounted (hidden via
              display, not unmounted) so switching back doesn't re-run its
              data fetch. */}
          {visited.ep && (
            <div style={{ display: tab === "ep" ? "block" : "none" }}>
              <EpScreen />
            </div>
          )}
          {visited.claims && (
            <div style={{ display: tab === "claims" ? "block" : "none" }}>
              <ClaimsScreen />
            </div>
          )}
        </div>
      </PrintProvider>
      </AutoRefreshProvider>
    </BusinessUnitProvider>
  );
}

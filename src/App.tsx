import { useState } from "react";
import ClaimsScreen from "./components/claims/ClaimsScreen";
import EpScreen from "./components/ep/EpScreen";
import { PrintProvider } from "./PrintProvider";
import { BusinessUnitProvider } from "./BusinessUnitProvider";
import BuStartupModal from "./components/shared/BuStartupModal";
import BuSelector from "./components/shared/BuSelector";
import Icon from "./components/ui/Icon";
import "./App.css";
import "./styles/print.css";

type Tab = "claims" | "ep";

export default function App() {
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
      <PrintProvider>
        <BuStartupModal />
        <div className="app-shell">
          <div className="app-tabs app-tabs-row">
            <div className="app-tabs-group">
              <button
                className={`app-tab-btn ${tab === "ep" ? "active" : ""}`}
                onClick={() => selectTab("ep")}
              >
                <Icon name="file-earmark-medical" /> eprescription
              </button>
              <button
                className={`app-tab-btn ${tab === "claims" ? "active" : ""}`}
                onClick={() => selectTab("claims")}
              >
                <Icon name="list-ul" /> Queue Claims
              </button>
            </div>
            <BuSelector />
          </div>

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
    </BusinessUnitProvider>
  );
}

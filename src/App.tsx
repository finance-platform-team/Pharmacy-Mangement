import { useState } from "react";
import ClaimsScreen from "./components/claims/ClaimsScreen";
import EpScreen from "./components/ep/EpScreen";
import { PrintProvider } from "./PrintProvider";

import "./App.css";
import "./styles/print.css";

type Tab = "claims" | "ep";

export default function App() {
  const [tab, setTab] = useState<Tab>("ep");

  return (
    <PrintProvider>
      <div style={{ padding: 24 }}>
        <div className="app-tabs">
          <button
            className={`app-tab-btn ${tab === "ep" ? "active" : ""}`}
            onClick={() => setTab("ep")}
          >
            <i className="bi bi-file-earmark-medical" /> eprescription
          </button>
          <button
            className={`app-tab-btn ${tab === "claims" ? "active" : ""}`}
            onClick={() => setTab("claims")}
          >
            <i className="bi bi-list-ul" /> Queue Claims
          </button>
        </div>

        {tab === "claims" ? <ClaimsScreen /> : <EpScreen />}
      </div>
    </PrintProvider>
  );
}
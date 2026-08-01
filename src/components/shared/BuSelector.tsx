import { useState } from "react";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./BuSelector.css";

const OPTIONS = ["ALL", "AMH", "ARC", "AAC", "ASH"];
export  const ALL_LABEL = "All BUs";

export default function BuSelector() {
  const { units, selectedBuName, setBu } = useBusinessUnitContext();
  const [open, setOpen] = useState(false);

  function handlePick(label: string) {
    if (label === "ALL") {
      setBu("ALL", ALL_LABEL);
      setOpen(false);
      return;
    }
    const match = units.find((u) => u.name.toLowerCase() === label.toLowerCase());
    if (!match) return;
    setBu(match.id, match.name);
    setOpen(false);
  }

  return (
    <div className="bu-selector">
      <button className="bu-selector-btn" onClick={() => setOpen((o) => !o)}>
        <i className="bi bi-geo-alt" /> {selectedBuName || "Select Branch"}
        <i className="bi bi-chevron-down" />
      </button>

      {open && (
        <>
          <div className="bu-selector-backdrop" onClick={() => setOpen(false)} />
          <div className="bu-selector-dropdown">
            {OPTIONS.map((label) => {
              const displayLabel = label === "ALL" ? ALL_LABEL : label;
              const isActive =
                label === "ALL"
                  ? selectedBuName === ALL_LABEL
                  : selectedBuName.toLowerCase() === label.toLowerCase();
              return (
                <button
                  key={label}
                  className={`bu-selector-option ${isActive ? "active" : ""}`}
                  onClick={() => handlePick(label)}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
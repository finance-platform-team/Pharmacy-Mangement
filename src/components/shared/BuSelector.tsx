import { useState } from "react";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./BuSelector.css";
import Icon from "../ui/Icon";

const OPTIONS = ["ALL", "AMH", "ARC", "AAC", "ASH"];
export  const ALL_LABEL = "All BUs";

export default function BuSelector() {
  const { units, loading, selectedBuName, setBu } = useBusinessUnitContext();
  const [open, setOpen] = useState(false);

  function handlePick(label: string) {
    if (label === "ALL") {
      setBu("ALL", ALL_LABEL);
      setOpen(false);
      return;
    }
    const match = units.find((u) => u.name.toLowerCase() === label.toLowerCase());
    if (!match) {
      console.warn(`[BU] "${label}" is not in the loaded business units (${units.length} loaded)`, units);
      return;
    }
    setBu(match.id, match.name);
    setOpen(false);
  }

  return (
    <div className="bu-selector">
      <span className="bu-selector-label">
        <Icon name="geo-alt-fill" /> Location
      </span>
      <button className="bu-selector-btn" onClick={() => setOpen((o) => !o)}>
        {selectedBuName || "Select Branch"}
        <Icon name="chevron-down" size={12} />
      </button>

      {open && (
        <>
          <div className="bu-selector-backdrop" onClick={() => setOpen(false)} />
          <div className="bu-selector-dropdown">
            {!loading && units.length === 0 && (
              <div className="bu-selector-note">
                No branches were found in this Dataverse, so only All BUs can be chosen.
              </div>
            )}
            {OPTIONS.map((label) => {
              const displayLabel = label === "ALL" ? ALL_LABEL : label;
              const isActive =
                label === "ALL"
                  ? selectedBuName === ALL_LABEL
                  : selectedBuName.toLowerCase() === label.toLowerCase();
              // A branch that is not among the loaded business units can't be picked.
              const missing =
                label !== "ALL" && !loading && !units.some((u) => u.name.toLowerCase() === label.toLowerCase());
              return (
                <button
                  key={label}
                  className={`bu-selector-option ${isActive ? "active" : ""}`}
                  disabled={missing}
                  title={missing ? "Not found in this Dataverse" : undefined}
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

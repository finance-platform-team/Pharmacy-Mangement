import { useState } from "react";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./BuSelector.css";
import Icon from "../ui/Icon";

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

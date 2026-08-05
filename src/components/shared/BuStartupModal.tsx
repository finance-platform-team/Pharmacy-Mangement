import Modal from "../ui/Modal";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./BuStartupModal.css";

const STARTUP_OPTIONS = ["AMH", "ARC", "AAC", "ASH"];

export default function BuStartupModal() {
  const { units, loading, hasSelectedBu, setBu } = useBusinessUnitContext();

  if (hasSelectedBu) return null;

  const handleSelect = (label: string) => {
    const match = units.find(
      (u) => u.name.toLowerCase() === label.toLowerCase()
    );
    if (!match) return; // لو مش موجود جوه الفروع اللي اتجابت، متعملش حاجة
    setBu(match.id, match.name);
  };

  return (
    <Modal
      open={true}
      onClose={() => {}}
      title="Select Business Unit"
      icon="bi-geo-alt"
    >
      {loading ? (
        <p className="bu-startup-loading">Loading branches…</p>
      ) : (
        <div className="bu-startup-grid">
          {STARTUP_OPTIONS.map((label) => (
            <button
              key={label}
              className="bu-startup-btn"
              onClick={() => handleSelect(label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

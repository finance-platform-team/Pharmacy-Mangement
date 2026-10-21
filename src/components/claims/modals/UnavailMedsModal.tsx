import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Icon from "../../ui/Icon";
import type { Visit, Medication } from "../../../domain/types";
import { fetchMedicationsForVisit } from "../../../api/medsApi";
import "./UnavailMedsModal.css";

interface UnavailMedsModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onConfirm: (selected: { id: string; name: string }[]) => void;
}

export default function UnavailMedsModal({
  open,
  visit,
  onClose,
  onConfirm,
}: UnavailMedsModalProps) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !visit) return;
    let cancelled = false;

    async function load() {
      // If the visit already carries loaded medications, use them directly;
      // otherwise fetch them live (mirrors the old openUnavailMedsModal()).
      let meds = visit!.medications;
      if (meds.length === 0) {
        setLoading(true);
        meds = await fetchMedicationsForVisit(visit!.id);
      }

      if (cancelled) return;
      setMeds(meds);
      setChecked(Object.fromEntries(meds.map((m) => [m.id, true])));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, visit]);

  if (!visit) return null;

  const allChecked = meds.length > 0 && meds.every((m) => checked[m.id]);

  function toggleAll(value: boolean) {
    setChecked(Object.fromEntries(meds.map((m) => [m.id, value])));
  }

  function toggleOne(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleConfirm() {
    const selected = meds
      .filter((m) => checked[m.id])
      .map((m) => ({ id: m.id, name: m.alternative || m.name }));
    onConfirm(selected);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Unavailable Medications"
      icon="bi-capsule-pill"
      size="md"
      footer={
        <>
          <Button variant="danger" icon="bi-check-lg" onClick={handleConfirm}>
            Confirm & Cancel Visit
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 14 }}>
        Select the medications that were not available for this visit:
      </p>

      {loading && <p style={{ textAlign: "center", padding: 12 }}>Loading medications…</p>}

      {!loading && meds.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: "0.83rem" }}>
          <Icon name="info-circle" className="me-1" /> No medications recorded for this visit.
        </div>
      )}

      {!loading && meds.length > 0 && (
        <>
          <div
            className="med-check-item avail-select-all"
            onClick={() => toggleAll(!allChecked)}
            style={{ cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <label style={{ cursor: "pointer", flex: 1, fontWeight: 700 }}>Select All</label>
          </div>

          {meds.map((m) => (
            <div
              className="med-check-item"
              key={m.id}
              onClick={() => toggleOne(m.id)}
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={!!checked[m.id]}
                onChange={() => toggleOne(m.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <label style={{ cursor: "pointer", flex: 1, fontSize: "0.83rem", fontWeight: 600 }}>
                {m.name}
                {m.dose && (
                  <span style={{ color: "var(--green-500)", fontWeight: 700 }}>
                    {" "}(Dosage Form: {m.dose})
                  </span>
                )}
                {m.alternative && (
                  <span style={{ color: "#991b1b", fontWeight: 400, fontSize: "0.72rem" }}>
                    {" "}(Alt: {m.alternative})
                  </span>
                )}
              </label>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

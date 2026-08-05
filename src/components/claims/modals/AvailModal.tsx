import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import "./AvailModal.css";
import Button from "../../ui/Button";
import Icon from "../../ui/Icon";
import type { Visit, Medication } from "../../../domain/types";
import { fetchMedicationsForVisit, updateMedicationAvailability, saveUnavailableMedications } from "../../../api/medsApi";

interface MedState {
  available: boolean;
  notes: string;
  alternative: string;
}

interface AvailModalProps {
  open: boolean;
  visit: Visit | null;
  systemUserId: string;
  onClose: () => void;
  onSaved: (visit: Visit) => void; // called after save, so caller can auto-attend if needed
}

export default function AvailModal({
  open,
  visit,
  systemUserId,
  onClose,
  onSaved,
}: AvailModalProps) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Record<string, MedState>>({});

  useEffect(() => {
    if (!open || !visit) return;
    let cancelled = false;

    async function load() {
      const source = visit!.medications.length > 0 ? visit!.medications : null;
      let list = source;
      if (!list) {
        setLoading(true);
        list = await fetchMedicationsForVisit(visit!.id);
      }
      if (cancelled) return;

      setMeds(list);
      setState(
        Object.fromEntries(
          list.map((m) => [
            m.id,
            { available: m.available !== false, notes: m.patientNotes || "", alternative: m.alternative || "" },
          ]),
        ),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, visit]);

  if (!visit) return null;

  const allAvailable = meds.length > 0 && meds.every((m) => state[m.id]?.available);

  function toggleAll(value: boolean) {
    setState((prev) => {
      const next = { ...prev };
      meds.forEach((m) => {
        next[m.id] = { ...next[m.id], available: value };
      });
      return next;
    });
  }

  function toggleOne(id: string) {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], available: !prev[id]?.available },
    }));
  }

  function updateField(id: string, field: "notes" | "alternative", value: string) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const entries = Object.entries(state);
      await Promise.all(
        entries.map(([id, s]) =>
          updateMedicationAvailability(id, s.available, s.notes, s.alternative),
        ),
      );

      const unavailable = meds
        .filter((m) => !state[m.id]?.available)
        .map((m) => ({ id: m.id, name: m.name }));

      if (unavailable.length > 0) {
        await saveUnavailableMedications(visit !, unavailable, systemUserId);
      }

      onSaved(visit !);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={visit.manual ? "Manual Prescription Check" : "Check Medication Availability"}
      icon={visit.manual ? "bi-file-earmark-image" : "bi-capsule-pill"}
      size="md"
      scrollable
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" icon="bi-check-lg" onClick={handleConfirm} loading={saving}>
            Confirm Selection
          </Button>
        </>
      }
    >
      {loading && <p style={{ textAlign: "center", padding: 12 }}>Loading medications…</p>}

      {!loading && meds.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
          <Icon name="info-circle" size={32} />
          <p style={{ marginTop: 8, fontSize: "0.85rem" }}>No medications for this visit.</p>
        </div>
      )}

      {!loading && meds.length > 0 && (
        <>
          <div style={{
            background: "#fefce8", border: "1px solid #fef08a", color: "#854d0e",
            padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <Icon name="exclamation-triangle-fill" />
            <span>Keep medications <strong>checked</strong> if available. Unchecked meds are recorded as shortages.</span>
          </div>

          <div
            className="med-check-item avail-select-all"
            onClick={() => toggleAll(!allAvailable)}
            style={{ cursor: "pointer", marginBottom: 12 }}
          >
            <input
              type="checkbox"
              checked={allAvailable}
              onChange={(e) => toggleAll(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <label style={{ cursor: "pointer", flex: 1, fontWeight: 700 }}>
              Select All Available
            </label>
          </div>

          {meds.map((m) => {
            const s = state[m.id];
            if (!s) return null;
            return (
              <div
                key={m.id}
                className={`avail-med-block ${s.available ? "is-available" : ""}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={s.available}
                    onChange={() => toggleOne(m.id)}
                    style={{ width: 17, height: 17, accentColor: "var(--green-500)", cursor: "pointer" }}
                  />
                  <label
                    onClick={() => toggleOne(m.id)}
                    style={{ cursor: "pointer", flex: 1, fontWeight: 700, fontSize: "0.83rem" }}
                  >
                    {m.name}
                    {m.discontinued && (
                      <span className="med-disc-badge" style={{ marginLeft: 6, fontSize: "0.65rem", color: "#991b1b" }}>
                        Discontinued
                      </span>
                    )}
                  </label>
                </div>

                <span className="avail-field-label">
                  <Icon name="chat-left-text" className="me-1" />Patient Notes
                </span>
                <input
                  type="text"
                  className="avail-notes-inp"
                  placeholder="Notes for patient…"
                  maxLength={250}
                  value={s.notes}
                  onChange={(e) => updateField(m.id, "notes", e.target.value)}
                />

                <div className="avail-alt-block">
                  <span style={{ fontSize: "0.67rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>
                    <Icon name="arrow-repeat" /> Alternative Medication
                  </span>
                  <input
                    type="text"
                    className="avail-alt-inp"
                    placeholder="Alternative name…"
                    maxLength={250}
                    value={s.alternative}
                    onChange={(e) => updateField(m.id, "alternative", e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
    </Modal>
  );
}

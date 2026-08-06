import { useEffect, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Icon from "../../ui/Icon";
import type { Visit } from "../../../domain/types";
import { updateVisitDetails, updatePatientAddress } from "../../../api/visitsApi";
import { fetchMedicationsForVisit } from "../../../api/medsApi";
import { DELIVERY_LABEL, CHRONIC_LABEL, DELIVERY_AND_CHRONIC_LABEL, NOTES_LABEL } from "../../../domain/status";
import { buildTimeline } from "../../../domain/timeline";
import "./EditModal.css";
import AttachmentsPanel from "../../attachments/AttachmentsPanel";
import PrintQueueModal from "./PrintQueueModal";

interface EditModalProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditModal({ open, visit, onClose, onSaved }: EditModalProps) {
  if (!visit) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          Edit Insurance Claim
          <span className={`sbadge s-${visit.status.toLowerCase()}`} style={{ marginLeft: 10 }}>
            {visit.status}
          </span>
        </>
      }
      icon="bi-pencil-square"
      size="lg"
      scrollable
      footer={null}
    >
      <EditModalForm key={visit.id} visit={visit} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

interface EditModalFormProps {
  visit: Visit;
  onClose: () => void;
  onSaved: () => void;
}

function EditModalForm({ visit, onClose, onSaved }: EditModalFormProps) {
  const [delivery, setDelivery] = useState(visit.deliveryCode != null ? String(visit.deliveryCode) : "");
  const [chronic, setChronic] = useState(visit.chronicCode != null ? String(visit.chronicCode) : "");
  const [dac, setDac] = useState(visit.deliveryAndChronic != null ? String(visit.deliveryAndChronic) : "");
  const [refillDay, setRefillDay] = useState(visit.refillDay != null ? String(visit.refillDay) : "");
  const [notes, setNotes] = useState(visit.notesCode != null ? String(visit.notesCode) : "");
  const [specialNotes, setSpecialNotes] = useState(visit.specialNotes || "");
  const [address, setAddress] = useState(visit.address || "");
  const [doctorName] = useState(visit.physician || "");
  const [manualSpecialty] = useState(visit.specialty || "");
  const [saving, setSaving] = useState(false);
  const [showPrintQueue, setShowPrintQueue] = useState(false);

  const [medications, setMedications] = useState(visit.medications);
  const [medsLoading, setMedsLoading] = useState(visit.medications.length === 0);

  useEffect(() => {
    if (visit.medications.length > 0) return;

    let cancelled = false;
    fetchMedicationsForVisit(visit.id)
      .then((meds) => {
        if (!cancelled) setMedications(meds);
      })
      .catch((err) => {
        console.warn("Failed to fetch medications for EditModal:", err);
      })
      .finally(() => {
        if (!cancelled) setMedsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visit.id]);

  const isCancelled = visit.status === "Cancelled";
  const isDispensed = visit.status === "Dispensed";
  const locked = isCancelled;

  const dacNum = dac !== "" ? parseInt(dac, 10) : -1;
  const showDelivery = dacNum === 1 || dacNum === 2;
  const showChronic = dacNum === 0 || dacNum === 2;
  const showRefill = dacNum === 0 || dacNum === 2;
  const showAddress = dacNum === 1 || dacNum === 2;

  async function handleSave() {
    setSaving(true);
    try {
      await updateVisitDetails(visit.id, {
        delivery: delivery !== "" ? parseInt(delivery, 10) : undefined,
        chronic: chronic !== "" ? parseInt(chronic, 10) : undefined,
        deliveryAndChronic: dac !== "" ? parseInt(dac, 10) : null,
        refillDay: refillDay !== "" ? parseInt(refillDay, 10) : undefined,
        notes: notes !== "" ? parseInt(notes, 10) : undefined,
        specialNotes,
        ...(visit.manual ? { doctorName, manualSpecialty } : {}),
      });

      if (visit.patientId) {
        await updatePatientAddress(visit.patientId, address);
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const isExternalManual = visit.manual && (visit.physician === "External" || visit.specialty === "External");

  return (
    <>
      {isCancelled && (
        <div style={{
          marginBottom: 14, padding: "10px 14px",
          background: "rgba(184,62,62,.09)", border: "1.5px solid rgba(184,62,62,.3)",
          borderRadius: 8, color: "#b83e3e", fontSize: 13, fontWeight: 500,
        }}>
          <Icon name="x-circle" className="me-1" /> This visit is cancelled — fields are read-only.
        </div>
      )}

      <div className="edit-body-row">
        <div className="edit-main-col">
          <div className="edit-field-grid">
            <div>
              <label className="flabel">Patient Name</label>
              <input className="fcontrol" value={visit.patientName} readOnly />
            </div>
            <div>
              <label className="flabel">Phone</label>
              <input className="fcontrol" value={visit.patientPhone} readOnly />
            </div>
          </div>

          <div className="edit-field-grid">
            <div>
              <label className="flabel">Visit ID</label>
              <input className="fcontrol" value={visit.visitId} readOnly />
            </div>
            <div>
              <label className="flabel">Total Est. Price</label>
              <input
                className="fcontrol"
                value={visit.totalEstPrice ? `${visit.totalEstPrice.toLocaleString()} EGP` : "—"}
                readOnly
              />
            </div>
          </div>

          <div className="edit-field-grid full">
            <div>
              <label className="flabel">Diagnosis</label>
              <input className="fcontrol fcontrol-highlight" value={visit.diagnosis || "—"} readOnly />
            </div>
          </div>

          <div className="edit-field-grid">
            <div>
              <label className="flabel">Branch (BU)</label>
              <input className="fcontrol" value={visit.buText || "—"} readOnly />
            </div>
          </div>

          <div className="edit-field-grid">
            <div>
              <label className="flabel">Company</label>
              <input className="fcontrol" value={visit.company || "—"} readOnly />
            </div>
            <div>
              <label className="flabel">Subcontractor</label>
              <input className="fcontrol" value={visit.subcontractor || "—"} readOnly />
            </div>
          </div>

          <div className="edit-field-grid">
            {visit.manual ? (
              <>
                <div>
                  <label className="flabel">Doctor Name</label>
                  <input className="fcontrol" value={doctorName} readOnly />
                </div>
                <div>
                  <label className="flabel">Specialty</label>
                  <input className="fcontrol" value={manualSpecialty} readOnly />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="flabel">Physician</label>
                  <input className="fcontrol" value={visit.physician || "—"} readOnly />
                </div>
                <div>
                  <label className="flabel">Specialty</label>
                  <input className="fcontrol" value={visit.specialty || "—"} readOnly />
                </div>
              </>
            )}
          </div>

          <div className="edit-field-grid">
            <div>
              <label className="flabel">Delivery & Chronic</label>
              <select className="fcontrol" value={dac} disabled={locked} onChange={(e) => setDac(e.target.value)}>
                <option value="">— Select —</option>
                {Object.entries(DELIVERY_AND_CHRONIC_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            {showAddress && (
              <div>
                <label className="flabel">Address</label>
                <input
                  className="fcontrol"
                  value={address}
                  disabled={locked}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            )}
          </div>

          {(showDelivery || showChronic || showRefill) && (
            <div className="edit-field-grid">
              {showDelivery && (
                <div>
                  <label className="flabel">Delivery Status</label>
                  <select className="fcontrol" value={delivery} disabled={locked} onChange={(e) => setDelivery(e.target.value)}>
                    <option value="">— Select —</option>
                    {Object.entries(DELIVERY_LABEL).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              {showChronic && (
                <div>
                  <label className="flabel">Chronic Status</label>
                  <select className="fcontrol" value={chronic} disabled={locked} onChange={(e) => setChronic(e.target.value)}>
                    <option value="">— Select —</option>
                    {Object.entries(CHRONIC_LABEL).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              {showRefill && (
                <div>
                  <label className="flabel">Refill Day</label>
                  <input
                    className="fcontrol"
                    type="number"
                    value={refillDay}
                    disabled={locked}
                    onChange={(e) => setRefillDay(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="edit-field-grid full">
            <div>
              <label className="flabel">Notes</label>
              <select className="fcontrol" value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)}>
                <option value="">— Select —</option>
                {Object.entries(NOTES_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="edit-field-grid full">
            <div>
              <label className="flabel">Special Notes</label>
              <textarea
                className="fcontrol"
                rows={2}
                value={specialNotes}
                disabled={locked}
                onChange={(e) => setSpecialNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

    <div className="edit-side-col">
          <div className="edit-section-card">
            <div className="edit-section-title">
              <Icon name="capsule-pill" /> Medications
            </div>
            {medsLoading ? (
              <div className="edit-section-empty">
                <Icon name="hourglass-split" />
                Loading medications…
              </div>
            ) : medications.length === 0 ? (
              <div className="edit-section-empty">
                <Icon name="info-circle" />
                {isExternalManual ? "External Claim (No DotCare Sync Available)" : "No medications listed."}
              </div>
            ) : (
              medications.map((m) => (
                <div className="med-item" key={m.id}>
                  <strong>{m.name}</strong>
                  {m.dose && <span> (Dosage Form: {m.dose})</span>}
                  {m.details && <div><span>Details: {m.details}</span></div>}
                  {m.patientNotes && <div><span>Patient Notes: {m.patientNotes}</span></div>}
                  {m.alternative && <div><span>Alternative: {m.alternative}</span></div>}
                </div>
              ))
            )}
          </div>

          <div className="edit-section-card">
            <div className="edit-section-title">
              <Icon name="clock-history" /> Timeline
            </div>
            <TimelineView visit={visit} />
          </div>
        </div>
      </div>

      <div className="edit-divider-section">
        <span>Insurance Card</span>
      </div>

      <AttachmentsPanel visit={visit} />

      {isDispensed && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 10 }}>
          This visit has been dispensed — some workflow actions no longer apply.
        </p>
      )}

      <div className="edit-sticky-footer">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {!isCancelled && !isDispensed && (
          <Button variant="gold" icon="bi-printer" onClick={() => setShowPrintQueue(true)}>
            Print Queue No.
          </Button>
        )}
        {!isCancelled && (
          <Button variant="primary" icon="bi-floppy" onClick={handleSave} loading={saving}>
            Save Data
          </Button>
        )}
      </div>

      <PrintQueueModal
        open={showPrintQueue}
        visit={visit}
        onClose={() => setShowPrintQueue(false)}
      />
    </>
  );
}

function TimelineView({ visit }: { visit: Visit }) {
  const steps = buildTimeline(visit);

  if (steps.length === 0) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: 10 }}>
        No history available.
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", paddingLeft: 14, borderLeft: "2px solid #e2e8f0",
      marginLeft: 8, marginTop: 10,
    }}>
      {steps.map((s, i) => (
        <div key={`${s.label}-${i}`} style={{ position: "relative", marginBottom: 12 }}>
          <div style={{
            position: "absolute", width: 10, height: 10, background: "#49604c",
            borderRadius: "50%", left: -20, top: 4,
          }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{s.label}</div>
          {s.time && (
            <div style={{ fontSize: 11, color: "#64748b" }}>
              <Icon name="clock" className="me-1" />{s.time}
            </div>
          )}
          {s.user && (
            <div style={{ fontSize: 11, color: "#6b6b5e", marginTop: 2 }}>
              By: <strong>{s.user}</strong>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import SearchableSelect from "../ui/SearchableSelect";
import { createManualPrescription, waitForQueueNo } from "../../api/epApi";
import {
  searchOpd,
  fetchContractorsByBU,
  fetchPhysiciansByBU,
  type OpdSearchResult,
  type PhysicianOption,
  type ContractorOption,
} from "../../api/opdApi";
import { useBusinessUnitContext } from "../../BusinessUnitContext";
import "./EpManual.css";

interface EpManualProps {
  userId: string;
  showToast: (text: string, type?: "ok" | "err" | "warn") => void;
  onCancel: () => void;
  onCreated: (visit: { id: string; patientName: string; patientPhone: string; buText: string }) => void;
}

type Mode = "opd" | "external";

const NOTES_OPTIONS = [
  { id: "0", label: "Chronic" },
  { id: "1", label: "VIP" },
  { id: "2", label: "Chronic Delivery" },
  { id: "3", label: "Medical Priority" },
  { id: "4", label: "Cash" },
  { id: "5", label: "WhatsApp" },
  { id: "6", label: "Event" },
  { id: "7", label: "Walk-in" },
];

export default function EpManual({ userId, showToast, onCancel, onCreated }: EpManualProps) {
  const { units, selectedBuId } = useBusinessUnitContext();

  const [mode, setMode] = useState<Mode>("external");
  const [searchedOpd, setSearchedOpd] = useState(false);

  const [name, setName] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const [phone, setPhone] = useState("");
  const [doctorName, setDoctorName] = useState("External");
  const [doctorLocked, setDoctorLocked] = useState(true);
  const [specialty, setSpecialty] = useState("External");
  const [company, setCompany] = useState("");
  const [companyLocked, setCompanyLocked] = useState(false);
  const [subcontractor, setSubcontractor] = useState("");
  const [locationId, setLocationId] = useState(selectedBuId);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [opdResult, setOpdResult] = useState<OpdSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [companies, setCompanies] = useState<ContractorOption[]>([]);
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!locationId || companyLocked) {
        setCompanies([]);
        return;
      }
      const selectedUnit = units.find((u) => u.id === locationId);
      const buName = (selectedUnit?.name || "").toUpperCase();
      let targetBuId = locationId;
      if (buName === "AAC" || buName === "ARC") {
        const smh = units.find((u) => u.name.toUpperCase() === "SMH");
        if (smh) targetBuId = smh.id;
      }
      const list = await fetchContractorsByBU(targetBuId);
      if (!cancelled) setCompanies(list);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [locationId, companyLocked, units]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!locationId || mode !== "opd" || doctorLocked) {
        setPhysicians([]);
        return;
      }
      const selectedUnit = units.find((u) => u.id === locationId);
      const buName = (selectedUnit?.name || "").toUpperCase();
      let targetBuId = locationId;
      if (buName === "AAC" || buName === "ARC") {
        const smh = units.find((u) => u.name.toUpperCase() === "SMH");
        if (smh) targetBuId = smh.id;
      }
      const list = await fetchPhysiciansByBU(targetBuId);
      if (!cancelled) setPhysicians(list);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [locationId, mode, doctorLocked, units]);

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    setShowResults(false);
    setSearchedOpd(false);
    setNameLocked(false);
    setPhone("");
    setName("");
    setDiagnosis("");
    setSubcontractor("");
    if (newMode === "external") {
      setDoctorName("External");
      setSpecialty("External");
      setDoctorLocked(true);
      setCompany("");
      setCompanyLocked(false);
    } else {
      setDoctorName("");
      setSpecialty("");
      setDoctorLocked(false);
      setCompany("");
      setCompanyLocked(false);
    }
  }

  async function handleOpdSearch() {
    if (!phone.trim()) return;
    setSearching(true);
    try {
      const result = await searchOpd(phone.trim());
      setOpdResult(result);
      setSearchedOpd(true);

      if (result.patient) {
        setName(result.patient.opd_patientname || "");
        setNameLocked(true);
      } else {
        setNameLocked(false);
      }

      setDoctorLocked(false);
      setCompanyLocked(false);
      setSubcontractor("Manual");

      setShowResults(true);
    } finally {
      setSearching(false);
    }
  }

  function handlePickVisit(visitIndex: number) {
    const visit = opdResult?.visits[visitIndex];
    if (!visit) return;

    if (visit.opd_doctorname) {
      setDoctorName(visit.opd_doctorname);
      setDoctorLocked(true);
    } else {
      setDoctorName("");
      setDoctorLocked(false);
    }

    setSpecialty(visit.opd_specialty || "");

    if (visit.opd_contractorcompany) {
      setCompany(visit.opd_contractorcompany);
      setCompanyLocked(true);
    } else {
      setCompany("");
      setCompanyLocked(false);
    }

    setSubcontractor(visit.opd_contractorclient || "Manual");
    setDiagnosis(visit.opd_diagnosis || "");
    setShowResults(false);
  }

  function fmtOpdDate(iso?: string): string {
    if (!iso) return "No Date";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  function validate(): boolean {
    const next: Record<string, boolean> = {};
    if (!phone.trim()) next.phone = true;
    if (!name.trim()) next.name = true;
    if (!locationId) next.location = true;
    if (!company.trim()) next.company = true;
    if (mode === "opd" && !doctorName.trim()) next.doctor = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);

    let newVisitId: string;
    try {
      newVisitId = await createManualPrescription(
        {
          patientName: name.trim(),
          phone: phone.trim(),
          doctorName: doctorName.trim(),
          specialty: specialty.trim(),
          company: company.trim(),
          subcontractor: subcontractor.trim(),
          locationId,
          diagnosis: diagnosis.trim(),
          notes,
          specialNotes: specialNotes.trim(),
        },
        userId,
      );
    } catch (err) {
      console.error("Manual prescription create failed:", err);
      setErrors({ submit: true });
      setSaving(false);
      return;
    }

    setSaving(false);
    showToast("Draft created — fetching queue number…", "ok");

    const selectedUnit = units.find((u) => u.id === locationId);
    onCreated({
      id: newVisitId,
      patientName: name.trim(),
      patientPhone: phone.trim(),
      buText: selectedUnit?.name || "AAC",
    });

    waitForQueueNo(newVisitId)
      .then((qNum) => {
        if (qNum) {
          showToast(`Queue #${qNum} assigned to ${name.trim() || "patient"}`, "ok");
        }
      })
      .catch((err) => {
        console.warn("Queue number polling failed (non-fatal):", err);
      });
  }

  const opdFieldsReady = mode === "external" || searchedOpd;

  return (
    <div className="manual-form-card">
      <div className="manual-form-header">
        <Icon name="file-earmark-medical-fill" /> Create Manual Prescription
      </div>

      <div className="manual-form-notice">
        Only use this form if you have a <strong>handwritten claim</strong> and
        there is <strong>no ePrescription available</strong>. If you have an
        ePrescription or a Printed E-Claim, use the ePrescriptions screen instead.
      </div>

      <div className="manual-form-body">
        <div className="manual-type-toggle">
          <Icon name="toggle2-off" />
          <div style={{ flex: 1 }}>
            <div className="manual-type-toggle-label">Prescription Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`manual-type-btn ${mode === "opd" ? "active" : ""}`}
                onClick={() => handleModeChange("opd")}
              >
                <Icon name="search" /> OPD Search
              </button>
              <button
                type="button"
                className={`manual-type-btn ${mode === "external" ? "active" : ""}`}
                onClick={() => handleModeChange("external")}
              >
                <Icon name="pencil-square" /> External
              </button>
            </div>
          </div>
          <span className={`manual-type-badge ${mode}`}>
            {mode === "opd" ? "OPD" : "EXTERNAL"}
          </span>
        </div>

        <div className="manual-field-grid">
          <div className="manual-field">
            <label>Patient Name <span className="required-badge">Required</span></label>
            <input
              type="text"
              className={errors.name ? "err" : ""}
              placeholder={mode === "opd" ? "Search a phone number first" : "Enter patient name manually"}
              value={name}
              disabled={nameLocked || (mode === "opd" && !searchedOpd)}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> Patient name is required.
              </p>
            )}
          </div>
          <div className="manual-field" style={{ position: "relative" }}>
            <label>Phone <span className="required-badge">Required</span></label>
            {mode === "opd" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="tel"
                  className={errors.phone ? "err" : ""}
                  placeholder="Enter phone to search…"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleOpdSearch()}
                />
                <Button variant="gold" size="sm" icon="bi-search" onClick={handleOpdSearch} loading={searching}>
                  Search
                </Button>
              </div>
            ) : (
              <input
                type="tel"
                className={errors.phone ? "err" : ""}
                placeholder="Enter phone manually"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
            {errors.phone && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> Phone is required.
              </p>
            )}

            {showResults && opdResult && mode === "opd" && (
              <div className="opd-results-box">
                {!opdResult.patient && (
                  <div className="opd-results-empty">No patient found. You can pick details manually below.</div>
                )}
                {opdResult.patient && opdResult.visits.length === 0 && (
                  <div className="opd-results-empty">Patient found, but no visits recorded.</div>
                )}
                {opdResult.visits.map((v, i) => (
                  <div key={v.opd_visitid} className="opd-result-item" onClick={() => handlePickVisit(i)}>
                    <div className="opd-result-patient">{opdResult.patient?.opd_patientname || "Unknown"}</div>
                    <div className="opd-result-row">
                      <span className="opd-result-doctor">{v.opd_doctorname || "No Doctor"}</span>
                      <span className="opd-result-date">{fmtOpdDate(v.opd_visitcreateddate || v.createdon)}</span>
                    </div>
                    <div className="opd-result-specialty">{v.opd_specialty || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="manual-field-grid full">
          <div className="manual-field">
            <label>Location / Branch <span className="required-badge">Required</span></label>
            <select
              className={errors.location ? "err" : ""}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— Select a branch —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {errors.location && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> Branch is required.
              </p>
            )}
          </div>
        </div>

        {mode === "opd" && (
          <div className="manual-field-grid full">
            <div className="manual-field">
              <label>Diagnosis</label>
              <input
                type="text"
                placeholder={opdFieldsReady ? "Auto-filled from OPD visit" : "Search a phone number first"}
                value={diagnosis}
                disabled={!opdFieldsReady}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="manual-field-grid">
          <div className="manual-field">
            <label>Doctor Name {mode === "opd" && <span className="required-badge">Required</span>}</label>
            {mode === "opd" && !doctorLocked ? (
              <SearchableSelect
                className={errors.doctor ? "err" : ""}
                options={physicians.map((p) => ({ id: p.id, label: p.name }))}
                value={doctorName}
                disabled={!opdFieldsReady || !locationId}
                placeholder={
                  !opdFieldsReady ? "Search a phone number first" : locationId ? "Search doctor…" : "Select a branch first"
                }
                onChange={(id) => {
                  const p = physicians.find((x) => x.id === id);
                  setDoctorName(p?.name || "");
                  setSpecialty(p?.specialty || "");
                }}
              />
            ) : (
              <input type="text" className={errors.doctor ? "err" : ""} value={doctorName} disabled />
            )}
            {errors.doctor && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> Doctor name is required.
              </p>
            )}
          </div>
          <div className="manual-field">
            <label>Specialty</label>
            <input
              type="text"
              placeholder={mode === "opd" && !doctorLocked ? "Select doctor first" : ""}
              value={specialty}
              disabled
            />
          </div>
        </div>

        <div className="manual-field-grid full">
          <div className="manual-field">
            <label>Company <span className="required-badge">Required</span></label>
            {companyLocked ? (
              <input type="text" className={errors.company ? "err" : ""} value={company} disabled />
            ) : (
              <SearchableSelect
                className={errors.company ? "err" : ""}
                options={companies.map((c) => ({ id: c.id, label: c.name }))}
                value={company}
                disabled={mode === "opd" && !opdFieldsReady}
                placeholder={
                  mode === "opd" && !opdFieldsReady
                    ? "Search a phone number first"
                    : locationId
                    ? `Search (${companies.length} items)…`
                    : "Search companies…"
                }
                onChange={(_id, label) => setCompany(label)}
              />
            )}
            {errors.company && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> Company is required.
              </p>
            )}
          </div>
        </div>

        {mode === "opd" && (
          <div className="manual-field-grid full">
            <div className="manual-field">
              <label>Subcontractor</label>
              <input
                readOnly
                type="text"
                placeholder={opdFieldsReady ? "" : "Search a phone number first"}
                value={subcontractor}
              />
            </div>
          </div>
        )}

        <div className="manual-field-grid full">
          <div className="manual-field">
            <label>Notes</label>
            <SearchableSelect
              options={NOTES_OPTIONS}
              value={NOTES_OPTIONS.find((x) => x.id === notes)?.label || ""}
              placeholder="Search notes…"
              onChange={(id) => setNotes(id)}
            />
          </div>
        </div>

        <div className="manual-field-grid full">
          <div className="manual-field">
            <label>Special Notes</label>
            <textarea
              rows={3}
              placeholder="Any additional remarks"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
            />
          </div>
        </div>

        {errors.submit && (
          <p className="manual-field-error">
            <Icon name="exclamation-circle-fill" /> Could not create prescription. Please try again.
          </p>
        )}
      </div>

      <div className="manual-form-footer">
        <Button variant="ghost" icon="bi-arrow-left" onClick={onCancel}>
          Back to List
        </Button>
        <Button variant="gold" icon="bi-send" onClick={handleSubmit} loading={saving}>
          Submit Manual Prescription
        </Button>
      </div>
    </div>
  );
}
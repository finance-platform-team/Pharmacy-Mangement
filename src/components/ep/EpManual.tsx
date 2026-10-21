import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import SearchableSelect from "../ui/SearchableSelect";
import { createManualPrescription, waitForQueueNo } from "../../api/epApi";
import {
  searchOpd,
  fetchAllContractors,
  fetchAllPhysicians,
  filterContractorsForBranch,
  filterPhysiciansForBranch,
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Drops one field's error as soon as the user edits that field. */
  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  const [opdResult, setOpdResult] = useState<OpdSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [allContractors, setAllContractors] = useState<Awaited<ReturnType<typeof fetchAllContractors>>>([]);
  const [allPhysicians, setAllPhysicians] = useState<Awaited<ReturnType<typeof fetchAllPhysicians>>>([]);

  // Load the full contractor/physician tables once (cached across mounts —
  // mirrors PHWEBRESCOURCE.HTML's loadContractorCache()/loadPhysicianCache()
  // — and re-filter client-side per branch below instead of re-querying.
  useEffect(() => {
    let cancelled = false;
    fetchAllContractors().then((list) => {
      if (!cancelled) setAllContractors(list);
    });
    fetchAllPhysicians().then((list) => {
      if (!cancelled) setAllPhysicians(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companies = useMemo<ContractorOption[]>(() => {
    if (!locationId || companyLocked) return [];
    const selectedUnit = units.find((u) => u.id === locationId);
    return filterContractorsForBranch(allContractors, units, locationId, selectedUnit?.name || "");
  }, [locationId, companyLocked, units, allContractors]);

  const physicians = useMemo<PhysicianOption[]>(() => {
    if (!locationId || mode !== "opd" || doctorLocked) return [];
    const selectedUnit = units.find((u) => u.id === locationId);
    return filterPhysiciansForBranch(allPhysicians, units, locationId, selectedUnit?.name || "");
  }, [locationId, mode, doctorLocked, units, allPhysicians]);

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
    const next: Record<string, string> = {};

    const nameTrim = name.trim();
    if (!nameTrim) next.name = "Patient name is required.";
    else if (nameTrim.length < 3) next.name = "Patient name is too short (at least 3 characters).";
    else if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(nameTrim)) {
      next.name = "Patient name can contain letters only (no digits or symbols).";
    }

    const phoneTrim = phone.trim();
    const phoneDigits = phoneTrim.replace(/\D/g, "");
    if (!phoneTrim) next.phone = "Phone number is required.";
    else if (!/^\+?[\d\s()-]+$/.test(phoneTrim)) next.phone = "Phone number can contain digits only.";
    else if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      next.phone = "Enter a valid phone number (8 to 15 digits).";
    }

    if (!locationId) next.location = "Select a branch.";
    if (!company.trim()) next.company = "Select a company.";
    if (mode === "opd" && !doctorName.trim()) next.doctor = "Select a doctor.";

    setErrors(next);

    // Take the user to the first problem.
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          ".manual-form-body input.err, .manual-form-body .ui-select-trigger.err",
        );
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      });
    }
    return Object.keys(next).length === 0;
  }

  // Validates, then asks the user to confirm they checked the ePrescription
  // list and that the patient really is external, before anything is saved.
  function handleSubmit() {
    if (!validate()) return;
    setConfirmOpen(true);
  }

  async function doSubmit() {
    setConfirmOpen(false);
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
          // Matches PHWEBRESCOURCE.HTML's submit-time fallback (subcon ||
          // "Manual") — External mode never fills this field, and OPD mode
          // only does when a specific past visit's own contractor data is
          // picked, so both need the same default here.
          subcontractor: subcontractor.trim() || "Manual",
          locationId,
          diagnosis: diagnosis.trim(),
          notes,
          specialNotes: specialNotes.trim(),
        },
        userId,
      );
    } catch (err) {
      console.error("Manual prescription create failed:", err);
      setErrors({ submit: "Could not create the prescription." });
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
    <div className="ep-form-page">
    <div className="manual-back-bar">
      <Button variant="ghost" icon="bi-arrow-left" onClick={onCancel}>
        Back to List
      </Button>
    </div>
    <div className="manual-form-card">
      <div className="manual-form-header">
        <Icon name="file-earmark-medical-fill" /> Create Manual Prescription
      </div>

      <div className="manual-warning" role="alert">
        <Icon name="exclamation-triangle-fill" />
        <div>
          <strong>Use this form only as a last resort.</strong>
          <p>
            Create a manual prescription <strong>only after you have searched the patient&apos;s
            phone number in the ePrescriptions screen and confirmed that no prescription exists</strong>.
            If an ePrescription or a printed E-Claim is available, use the ePrescriptions screen
            instead. A duplicate manual entry creates a second claim for the same visit.
          </p>
          <ul>
            <li>Handwritten claim with <strong>no ePrescription</strong> in the system.</li>
            <li>
              The <strong>External</strong> type is for patients who are genuinely external
              (not treated at an Andalusia facility). Do not use it for an existing patient.
            </li>
          </ul>
        </div>
      </div>

      <div className="manual-form-body">
        <div className="manual-type-toggle">
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
            <label>Patient Name <span className="req-star" aria-hidden="true">*</span></label>
            <input
              type="text"
              className={errors.name ? "err" : ""}
              placeholder={mode === "opd" ? "Search a phone number first" : "Enter patient name manually"}
              value={name}
              disabled={nameLocked || (mode === "opd" && !searchedOpd)}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
            />
            {errors.name && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> {errors.name}
              </p>
            )}
          </div>
          <div className="manual-field" style={{ position: "relative" }}>
            <label>Phone <span className="req-star" aria-hidden="true">*</span></label>
            {mode === "opd" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="tel"
                  className={errors.phone ? "err" : ""}
                  placeholder="Enter phone to search…"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearError("phone");
                  }}
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
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
              />
            )}
            {errors.phone && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> {errors.phone}
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
            <label>Location / Branch <span className="req-star" aria-hidden="true">*</span></label>
            <Select
              className={errors.location ? "err" : ""}
              value={locationId}
              onChange={(v) => {
                setLocationId(v);
                clearError("location");
              }}
              placeholder="— Select a branch —"
              options={[
                { value: "", label: "— Select a branch —" },
                ...units.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
            {errors.location && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> {errors.location}
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
            <label>Doctor Name {mode === "opd" && <span className="req-star" aria-hidden="true">*</span>}</label>
            {mode === "opd" && !doctorLocked ? (
              <SearchableSelect
                className={errors.doctor ? "err" : ""}
                options={physicians.map((p) => ({ id: p.id, label: p.name }))}
                value={doctorName}
                disabled={!opdFieldsReady || !locationId}
                placeholder={
                  !opdFieldsReady
                    ? "Search a phone number first"
                    : locationId
                    ? `— Search (${physicians.length} items) —`
                    : "Select a branch first"
                }
                onChange={(id) => {
                  const p = physicians.find((x) => x.id === id);
                  setDoctorName(p?.name || "");
                  setSpecialty(p?.specialty || "");
                  clearError("doctor");
                }}
              />
            ) : (
              <input type="text" className={errors.doctor ? "err" : ""} value={doctorName} disabled />
            )}
            {errors.doctor && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> {errors.doctor}
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
            <label>Company <span className="req-star" aria-hidden="true">*</span></label>
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
                onChange={(_id, label) => {
                  setCompany(label);
                  clearError("company");
                }}
              />
            )}
            {errors.company && (
              <p className="manual-field-error">
                <Icon name="exclamation-circle-fill" /> {errors.company}
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

        <div className="manual-warning inline" role="note">
          <Icon name="info-circle-fill" />
          <p>
            {mode === "external"
              ? "External: select this only if you have verified the patient is truly external. If the patient has an Andalusia visit, find the ePrescription instead."
              : "OPD Search: select this only if the OPD visit has no ePrescription. Search the ePrescriptions screen by the patient's phone number first."}
          </p>
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

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm manual prescription"
        icon="bi-exclamation-triangle"
        footer={
          <>
            <Button variant="gold" icon="bi-check-lg" onClick={doSubmit}>
              Yes, I have verified — Submit
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Go Back
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0, fontWeight: 600 }}>Before you submit, please confirm that:</p>
        <ul className="manual-confirm-list">
          <li>
            You searched <strong>{phone.trim() || "the patient"}</strong> in the ePrescriptions
            screen and <strong>no prescription exists</strong> for this visit.
          </li>
          {mode === "external" && (
            <li>
              <strong>{name.trim() || "The patient"}</strong> is <strong>genuinely an external
              patient</strong> and not an existing Andalusia patient.
            </li>
          )}
        </ul>
        <p style={{ marginBottom: 0, color: "var(--text-muted)", fontSize: 13 }}>
          Submitting a duplicate creates a second claim for the same visit.
        </p>
      </Modal>
    </div>
    </div>
  );
}
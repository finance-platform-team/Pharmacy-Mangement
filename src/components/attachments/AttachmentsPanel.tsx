import { useCallback, useEffect, useRef, useState } from "react";
import type { Visit } from "../../domain/types";
import type { SpAttachmentVisit, SpFile } from "../../domain/ٍSpAttachments";
import {
  spDeleteFile,
  spDownloadBlob,
  spFetchFileDataUrl,
  spFileKind,
  spIsAllowedFile,
  spListFiles,
  spUploadFile,
} from "../../domain/ٍSpAttachments";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import ToastStack from "../ui/ToastStack";
import { useToast } from "../../hooks/useToast";
import { usePrint } from "../../PrintContext";
import "./AttachmentsPanel.css";

interface AttachmentsPanelProps {
  /** Accepts a full domain Visit (the 4 established usage sites), OR a minimal
   * object with just the fields the SharePoint flow needs — used right after
   * creating a manual prescription, before a full Visit has been reloaded. */
  visit: Visit | SpAttachmentVisit;
  /** Start the accordion expanded. Default false (matches OneDriveViewer). */
  defaultOpen?: boolean;
  /** Optional toast callback from the parent screen. If the parent already
   * has a visible ToastStack (like EpScreen), pass its showToast here so
   * messages land there. If omitted, this component shows its own toasts
   * via its own ToastStack — it never fails silently either way. */
  showToast?: (text: string, type?: "ok" | "err" | "warn") => void;
  /**
   * For ePrescriptions that only exist in the SQL view (no Dataverse row yet,
   * id starts with "view:"): saves the record first and resolves with its real
   * crf79_visitsid, so the SharePoint flow has a visit to attach to.
   */
  ensureSaved?: () => Promise<string>;
}

const SP_BLOCKED_HINT = "Executable/app files are not allowed for security reasons.";

/** Maps the domain Visit (or an already-minimal object) into the shape the SharePoint flow needs. */
function toSpAttachmentVisit(v: Visit | SpAttachmentVisit): SpAttachmentVisit {
  return {
    id: v.id,
    visitId: v.visitId,
    buText: v.buText,
    patientName: v.patientName,
    patientPhone: v.patientPhone,
    documentsLink: v.documentsLink,
  };
}

/**
 * Drop-in replacement for OneDriveViewer — same accordion shell and `visit` prop,
 * but no iframe anywhere. Folder link opens in a new tab; files are
 * listed/uploaded/printed/deleted through the single SharePoint flow.
 */
export default function AttachmentsPanel({ visit, defaultOpen = false, showToast: externalToast, ensureSaved }: AttachmentsPanelProps) {
  const spVisit = toSpAttachmentVisit(visit);
  const localToast = useToast();
  const showToast = externalToast ?? localToast.showToast;

  const [open, setOpen] = useState(defaultOpen);
  const [files, setFiles] = useState<SpFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<SpFile | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  // "image" only — PDFs are downloaded instead (see handleView), since the
  // host CSP won't allow framing/embedding a data: URI.
  const [previewFile, setPreviewFile] = useState<{ dataUrl: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { requestPrint } = usePrint();

  const load = useCallback(async () => {
    // Not saved to Dataverse yet — nothing can be attached, so nothing to list.
    if (spVisit.id.startsWith("view:")) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const result = await spListFiles(spVisit);
      setFiles(result);
    } catch (e) {
      showToast((e as Error).message || "Failed to load files", "err");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id, showToast]);

  useEffect(() => {
    // Intentional: fetch happens on open/visit change, not a synchronous
    // state-reset-from-prop case, so this isn't the key={} pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit.id]);


  const handleUpload = async (fileList: FileList | File[] | null | undefined) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    const allowed = files.filter(spIsAllowedFile);
    const rejected = files.length - allowed.length;
    if (rejected > 0) {
      showToast(
        rejected === files.length
          ? `File type not allowed. ${SP_BLOCKED_HINT}`
          : `${rejected} file(s) skipped. ${SP_BLOCKED_HINT}`,
        "err",
      );
    }
    if (allowed.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: allowed.length });
    let uploaded = 0;
    try {
      // An entry that is still only in the SQL view must be saved first.
      let target = spVisit;
      if (spVisit.id.startsWith("view:")) {
        if (!ensureSaved) {
          showToast("Save the prescription first (Take As Draft), then upload documents", "err");
          return;
        }
        try {
          target = { ...spVisit, id: await ensureSaved() };
        } catch (e) {
          showToast(`Could not save the prescription: ${(e as Error).message}`, "err");
          return;
        }
      }
      for (const [i, file] of allowed.entries()) {
        try {
          await spUploadFile(target, file);
          uploaded++;
        } catch (e) {
          showToast(`"${file.name}": ${(e as Error).message || "Upload failed"}`, "err");
        }
        setUploadProgress({ current: i + 1, total: allowed.length });
      }
      if (uploaded > 0) {
        showToast(uploaded === 1 ? `"${allowed[0].name}" uploaded` : `${uploaded} files uploaded`, "ok");
        await load();
      }
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const performDelete = async (f: SpFile) => {
    setConfirmDeleteFile(null);
    setDeletingPath(f.path);
    try {
      await spDeleteFile(spVisit, f.name, f.path);
      setFiles((prev) => prev.filter((x) => x.path !== f.path));
      showToast(`"${f.name}" deleted`, "ok");
    } catch (e) {
      showToast((e as Error).message || "Delete failed", "err");
    } finally {
      setDeletingPath(null);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  useEffect(() => {
    if (!previewFile) return;
    // Capture phase, so this runs BEFORE the parent <Modal>'s own Escape
    // listener (which is bubble-phase, on `document`) — stopPropagation()
    // here keeps Escape from also closing the Edit modal behind us.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closePreview();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [previewFile]);

  const handleView = async (f: SpFile) => {
    setBusyPath(f.path);
    const kind = spFileKind(f.name, f.url);
    showToast("Loading file…", "ok");
    try {
      const dataUrl = await spFetchFileDataUrl(spVisit, f.path, f.name);
      // PDFs can't be framed/embedded under this host's CSP (frame-src/
      // object-src only allow 'self' or the SharePoint domain, not a data:
      // URI), and opening the real SharePoint URL in a new tab depended on
      // an SSO session that wasn't reliably there — so, same as Word/Excel,
      // just download it immediately instead.
      if (kind === "other" || kind === "pdf") {
        spDownloadBlob(dataUrl, f.name);
        showToast(
          kind === "pdf" ? "Downloaded ✓" : "Downloaded — this file type can't be previewed here",
          "ok",
        );
        return;
      }
      setPreviewFile({ dataUrl, name: f.name });
    } catch (e) {
      showToast((e as Error).message || "Couldn't load this file", "err");
    } finally {
      setBusyPath(null);
    }
  };

  const handlePrint = async (f: SpFile) => {
    setBusyPath(f.path);
    const kind = spFileKind(f.name, f.url);
    showToast("Preparing file…", "ok");
    try {
      const dataUrl = await spFetchFileDataUrl(spVisit, f.path, f.name);
      if (kind === "other" || kind === "pdf") {
        spDownloadBlob(dataUrl, f.name);
        showToast("Downloaded — open it to print from its own app", "ok");
        return;
      }
      // image — route through the app's shared print portal (#printArea)
      requestPrint(
        <img src={dataUrl} alt={f.name} style={{ display: "block", width: "100%", height: "auto" }} />,
      );
    } catch (e) {
      showToast((e as Error).message || "Couldn't load this file for printing", "err");
    } finally {
      setBusyPath(null);
    }
  };

  return (
    <div className="od-accordion">
      <button
        type="button"
        className="od-accordion-header"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="cloud-arrow-up-fill" className="od-header-icon" /> Documents
        <Icon name={`chevron-${open ? "up" : "down"}`} className="od-chevron" />
      </button>

      {open && (
        <div className="od-accordion-body">
          <div className="od-toolbar">
            <button type="button" className="btn-t od-btn" onClick={load} disabled={loading}>
              <Icon name="arrow-clockwise" /> Refresh
            </button>
            {spVisit.documentsLink ? (
              <a
                className="btn-t od-btn"
                href={spVisit.documentsLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="box-arrow-up-right" /> Open Folder
              </a>
            ) : (
              <span className="od-btn od-btn-hint">Folder link appears after first upload</span>
            )}
          </div>

          <div
            className={`attach-dropzone${dragOver ? " drag-over" : ""}${uploading ? " uploading" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleUpload(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <span className="spinner-border spinner-border-sm attach-dropzone-spinner" />
            ) : (
              <Icon name="cloud-arrow-up-fill" className="attach-dropzone-icon" />
            )}
            <span>
              {uploading
                ? uploadProgress.total > 1
                  ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                  : "Uploading…"
                : "Click or drag files here to upload"}
            </span>
          </div>

          <div className="attach-list">
            {loading && files.length === 0 && <div className="od-empty">Loading…</div>}
            {!loading && files.length === 0 && (
              <div className="od-empty">No files uploaded for this visit yet.</div>
            )}
            {files.map((f) => (
              <div className="attach-row" key={f.path}>
                <span className="attach-name" title={f.name}>
                  {f.name}
                </span>
                <div className="attach-actions">
                  <button
                    type="button"
                    className="btn-u btn-u-sm btn-u-success"
                    disabled={busyPath === f.path}
                    onClick={() => handleView(f)}
                  >
                    <Icon name="eye" /> View
                  </button>
                  <button
                    type="button"
                    className="btn-u btn-u-sm btn-u-primary"
                    disabled={busyPath === f.path}
                    onClick={() => handlePrint(f)}
                  >
                    <Icon name="printer" /> Print
                  </button>
                  <button
                    type="button"
                    className="btn-u btn-u-sm btn-u-danger"
                    disabled={deletingPath === f.path}
                    onClick={() => setConfirmDeleteFile(f)}
                  >
                    {deletingPath === f.path ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-app confirm — no window.confirm, which the Power Apps host renders unreliably */}
      <Modal open={!!confirmDeleteFile} onClose={() => setConfirmDeleteFile(null)} title="Delete file?">
        {confirmDeleteFile && (
          <div className="attach-confirm-body">
            <p>
              Delete <strong>{confirmDeleteFile.name}</strong>? This can't be undone.
            </p>
            <div className="attach-confirm-actions">
              <Button variant="danger" icon="bi-trash" onClick={() => performDelete(confirmDeleteFile)}>
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDeleteFile(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full-screen image preview — fetched as a data: URI (the Power Apps
          host's CSP blocks blob: for img-src, so blob URLs never render here) */}
      {previewFile && (
        <div className="attach-preview-overlay" onClick={closePreview}>
          <button type="button" className="attach-preview-close" onClick={closePreview}>
            <Icon name="x-lg" />
          </button>
          <div className="attach-preview-media" onClick={(e) => e.stopPropagation()}>
            <img src={previewFile.dataUrl} alt={previewFile.name} className="attach-preview-image" />
          </div>
        </div>
      )}

      {/* Only render our own toast stack when the parent didn't give us one */}
      {!externalToast && <ToastStack toasts={localToast.toasts} />}
    </div>
  );
}
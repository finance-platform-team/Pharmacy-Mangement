import { useCallback, useEffect, useRef, useState } from "react";
import type { Visit } from "../../domain/types";
import type { SpAttachmentVisit, SpFile } from "../../domain/ٍSpAttachments";
import {
  predictOneDriveLink,
  spDeleteFile,
  spListFiles,
  spPrintFile,
  spUploadFile,
} from "../../domain/ٍSpAttachments";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import ToastStack from "../ui/ToastStack";
import { useToast } from "../../hooks/useToast";
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
}

const ALLOWED_ATTACHMENT_MIME_PREFIXES = ["image/"];
const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx," +
  ALLOWED_ATTACHMENT_MIME_TYPES.join(",");

/** Only PDFs, Word/Excel documents, and images may be uploaded as attachments. */
function isAllowedAttachment(file: File): boolean {
  if (ALLOWED_ATTACHMENT_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  if (ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Maps the domain Visit (or an already-minimal object) into the shape the SharePoint flow needs. */
function toSpAttachmentVisit(v: Visit | SpAttachmentVisit): SpAttachmentVisit {
  return {
    id: v.id,
    visitId: v.visitId,
    buText: v.buText,
    patientName: v.patientName,
    patientPhone: v.patientPhone,
  };
}

/**
 * Drop-in replacement for OneDriveViewer — same accordion shell and `visit` prop,
 * but no iframe anywhere. Folder link opens in a new tab; files are
 * listed/uploaded/printed/deleted through the single SharePoint flow.
 */
export default function AttachmentsPanel({ visit, defaultOpen = false, showToast: externalToast }: AttachmentsPanelProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
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

    const allowed = files.filter(isAllowedAttachment);
    const rejected = files.length - allowed.length;
    if (rejected > 0) {
      showToast(
        rejected === files.length
          ? "File type not allowed — only PDF, Word, Excel, PowerPoint, or image files are accepted"
          : `${rejected} file(s) skipped — only PDF, Word, Excel, PowerPoint, or image files are accepted`,
        "err",
      );
    }
    if (allowed.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: allowed.length });
    let uploaded = 0;
    try {
      for (const [i, file] of allowed.entries()) {
        try {
          await spUploadFile(spVisit, file);
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

  const handlePrint = (f: SpFile) => {
    const ok = spPrintFile(f.url, f.name);
    if (!ok) showToast("Please allow pop-ups to print", "warn");
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
            <a
              className="btn-t od-btn"
              href={predictOneDriveLink(spVisit)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="box-arrow-up-right" /> Open Folder
            </a>
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
              accept={ATTACHMENT_ACCEPT}
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
                  <a className="btn-u btn-u-sm btn-u-success" href={f.url} target="_blank" rel="noreferrer">
                    View
                  </a>
                  <button type="button" className="btn-u btn-u-sm btn-u-primary" onClick={() => handlePrint(f)}>
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
              <Button variant="ghost" onClick={() => setConfirmDeleteFile(null)}>
                Cancel
              </Button>
              <Button variant="danger" icon="bi-trash" onClick={() => performDelete(confirmDeleteFile)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Only render our own toast stack when the parent didn't give us one */}
      {!externalToast && <ToastStack toasts={localToast.toasts} />}
    </div>
  );
}
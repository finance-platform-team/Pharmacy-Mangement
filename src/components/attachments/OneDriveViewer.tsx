import { useState } from "react";
import type { Visit } from "../../domain/types";
import { resolveOneDriveLink } from "../../domain/onedrive";
import "./OneDriveViewer.css";

interface OneDriveViewerProps {
  visit: Visit;
}

export default function OneDriveViewer({ visit }: OneDriveViewerProps) {
  const [open, setOpen] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const link = resolveOneDriveLink(visit.documentsLink);

  return (
    <div className="od-accordion">
      <button
        type="button"
        className="od-accordion-header"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="bi bi-cloud-arrow-up-fill" /> OneDrive Documents
        <i className={`bi bi-chevron-${open ? "up" : "down"} od-chevron`} />
      </button>

      {open && (
        <div className="od-accordion-body">
          {link ? (
            <>
              <div className="od-toolbar">
                <button
                  type="button"
                  className="btn-t od-btn"
                  onClick={() => setFrameKey((k) => k + 1)}
                >
                  <i className="bi bi-arrow-clockwise" /> Refresh Frame
                </button>
                
                <a  className="btn-t od-btn"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-box-arrow-up-right" /> Open in Tab
                </a>
              </div>
              <iframe
                key={frameKey}
                className="od-iframe"
                src={link}
                title="OneDrive Documents"
              />
            </>
          ) : (
            <div className="od-empty">
              <i className="bi bi-cloud-slash" />
              No OneDrive link found for this visit.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
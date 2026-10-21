import type { ReactNode } from "react";
// Bundled as a data URI: the Power Apps host blocks images from other domains.
import logoUrl from "../../assets/andalusia-health-logo.png?inline";

interface PrintShellProps {
  children: ReactNode;
  /** Business unit / branch name shown top-right of the header. Falls back to "PHARMACY DEPARTMENT" if not provided. */
  branchLabel?: string;
}

/**
 * Mirrors the old buildPrintShell(contentHtml): wraps any print content
 * with the Andalusia logo header and the "Printed: <timestamp>" footer.
 * Used by every print type (prescription, queue ticket, ...).
 */
export default function PrintShell({ children, branchLabel }: PrintShellProps) {
  return (
    <>
      <div className="pr-header">
        <div className="pr-header-left">
          <img
            className="pr-header-logo"
            src={logoUrl}
            alt="Andalusia Health"
          />
        </div>
        <div className="pr-header-right">{branchLabel || "PHARMACY DEPARTMENT"}</div>
      </div>
      {children}
      <div className="pr-footer">
        <span>Andalusia Healthcare – Pharmacy System</span>
        <span>Printed: {new Date().toLocaleString("en-GB")}</span>
      </div>
    </>
  );
}

import type { ReactNode } from "react";
import { useEffect } from "react";
import Icon from "./Icon";
import "./Modal.css";

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: string;          // مثال: "bi-capsule-pill"
  size?: Size;
  scrollable?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  icon,
  size = "md",
  scrollable = false,
  footer,
  children,
}: ModalProps) {
  // ESC يقفل المودال - بديل سلوك Bootstrap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-u-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-u-dialog modal-u-${size} ${
          scrollable ? "modal-u-scrollable" : ""
        }`}
      >
        <div className="modal-u-header">
          <h5 className="modal-u-title">
            {icon && <Icon name={icon} />}
            {title}
          </h5>
          <button className="modal-u-close" onClick={onClose}>
            <Icon name="x-lg" />
          </button>
        </div>

        <div className="modal-u-body">{children}</div>

        {footer && <div className="modal-u-footer">{footer}</div>}
      </div>
    </div>
  );
}

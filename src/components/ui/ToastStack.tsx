import type { ToastMsg } from "../../hooks/useToast";
import "./Toast.css";

const ICONS: Record<string, string> = {
  ok: "✅",
  err: "❌",
  warn: "⚠️",
};

export default function ToastStack({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-item ${t.type === "err" ? "err" : t.type === "warn" ? "warn" : ""} ${
            t.fading ? "fading" : ""
          }`}
        >
          <span>{ICONS[t.type]}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
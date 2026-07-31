import { useCallback, useRef, useState } from "react";

export type ToastType = "ok" | "err" | "warn";

export interface ToastMsg {
  id: number;
  text: string;
  type: ToastType;
  fading: boolean;
}

const ICONS: Record<ToastType, string> = {
  ok: "✅",
  err: "❌",
  warn: "⚠️",
};

let nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const showToast = useCallback(
    (text: string, type: ToastType = "ok", duration = 3200) => {
      if (!text) return;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, text, type, fading: false }]);

      timers.current[id] = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, fading: true } : t)),
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 400);
      }, duration);
    },
    [],
  );

  return { toasts, showToast, ICONS };
}
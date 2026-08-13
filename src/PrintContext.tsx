import { createContext, useContext, type ReactNode } from "react";

export interface PrintContextValue {
  /** Sets the printable JSX and triggers window.print(). Content is cleared automatically after printing (or after the print dialog is cancelled). */
  requestPrint: (node: ReactNode) => void;
}

export const PrintContext = createContext<PrintContextValue | null>(null);

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrint() must be used inside <PrintProvider>");
  return ctx;
}

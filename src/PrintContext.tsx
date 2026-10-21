import { createContext, useContext, type ReactNode } from "react";

export interface PrintContextValue {
  /**
   * Sets the printable JSX and triggers window.print(). Content is cleared automatically after printing (or after the print dialog is cancelled).
   * `options.pageSize` is a CSS @page size (e.g. "80mm 110mm" for the queue-ticket roll); without it the normal full-page layout is used.
   */
  requestPrint: (node: ReactNode, options?: PrintOptions) => void;
}

export interface PrintOptions {
  /** CSS @page "size" value, e.g. "80mm 110mm". */
  pageSize?: string;
}

export const PrintContext = createContext<PrintContextValue | null>(null);

export function usePrint(): PrintContextValue {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrint() must be used inside <PrintProvider>");
  return ctx;
}

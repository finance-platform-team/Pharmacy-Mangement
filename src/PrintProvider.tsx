import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PrintContext, type PrintOptions } from "./PrintContext";

export function PrintProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [pageSize, setPageSize] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const requestPrint = useCallback((node: ReactNode, options?: PrintOptions) => {
    pendingRef.current = true;
    setPageSize(options?.pageSize ?? null);
    setContent(node);
  }, []);

  // A custom paper (the queue-ticket roll) needs its own @page size, and CSS
  // can't switch @page by content — so it is injected for the duration of this
  // print only. Declared before the print effect so it is in the DOM first.
  useEffect(() => {
    if (!pageSize) return;
    const style = document.createElement("style");
    style.setAttribute("data-print-page", "");
    style.textContent = `@media print { @page { size: ${pageSize}; margin: 0; } }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [pageSize]);

  // Wait for an actual browser paint after content is set before calling
  // window.print() — a plain setTimeout can fire before the browser has
  // painted #printArea, producing a blank print preview. Two nested
  // requestAnimationFrame calls guarantee at least one full paint has
  // happened: the first rAF runs before the paint that includes our new
  // content, the second rAF runs after it.
  useEffect(() => {
    if (content !== null && pendingRef.current) {
      pendingRef.current = false;
      let rafId2 = 0;
      const rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          window.print();
        });
      });
      return () => {
        cancelAnimationFrame(rafId1);
        cancelAnimationFrame(rafId2);
      };
    }
  }, [content]);

  // Clear the print content once the browser's print dialog closes —
  // equivalent to the old document.getElementById("printArea").innerHTML = "".
  useEffect(() => {
    function handleAfterPrint() {
      setContent(null);
      setPageSize(null);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  return (
    <PrintContext.Provider value={{ requestPrint }}>
      {children}
      {/*
        IMPORTANT: this must be a portal directly into document.body, NOT a
        normal child rendered inside #root. The print CSS (styles/print.css)
        uses the selector `body > *:not(#printArea)` to hide the whole app
        while printing — copied as-is from the original HTML where
        #printArea really was a direct child of <body>. In our React app
        everything normally renders inside #root, so #printArea would be a
        grandchild of body, not a direct child — the CSS selector would then
        hide #root (which still contains #printArea inside it), and nothing
        would print at all. The portal makes #printArea a true direct
        sibling of #root under <body>, matching what the CSS expects.
      */}
      {createPortal(
        <div id="printArea" className={pageSize ? "pr-ticket-area" : undefined}>
          {content}
        </div>,
        document.body,
      )}
    </PrintContext.Provider>
  );
}

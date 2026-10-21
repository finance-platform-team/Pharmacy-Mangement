import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import "./Popover.css";

interface PopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Minimum width on desktop (px). The menu is at least as wide as its anchor. */
  minWidth?: number;
  className?: string;
}

const GAP = 4;
const EDGE = 8;

/**
 * Floating panel for the custom dropdowns / date picker. The browser draws
 * native <select> and <input type="date"> popups itself, outside the page,
 * so they can't follow the layout (and look oversized next to a phone-sized
 * app). This one lives in the page: always anchored right under its field
 * (flipping upward near the bottom edge, clamped inside the screen), on phones
 * too. Rendered in a portal so modals / scroll containers can't clip it.
 */
export default function Popover({
  open,
  anchorRef,
  onClose,
  children,
  minWidth = 0,
  className,
}: PopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    // Measuring the anchor needs the DOM, so placement is computed after mount.
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, minWidth), vw - EDGE * 2);
    const left = Math.min(Math.max(rect.left, EDGE), vw - width - EDGE);
    const spaceBelow = vh - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(360, openUp ? spaceAbove : spaceBelow));

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStyle(
      openUp
        ? { left, width, maxHeight, bottom: vh - rect.top + GAP }
        : { left, width, maxHeight, top: rect.bottom + GAP },
    );
  }, [open, anchorRef, minWidth]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    function onScrollOrResize(e: Event) {
      // Scrolling inside the menu itself must not close it.
      if (e.type === "scroll" && popRef.current?.contains(e.target as Node)) return;
      onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return createPortal(
    <div ref={popRef} className={`ui-pop ${className ?? ""}`} style={style}>
      {children}
    </div>,
    document.body,
  );
}

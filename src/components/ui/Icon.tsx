import type { CSSProperties } from "react";
import {
  FileEarmarkMedical, ListUl, CloudArrowUpFill, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, ArrowClockwise, BoxArrowUpRight, CloudSlash,
  CheckCircleFill, XCircleFill, JournalText, FileEarmarkImage, HourglassSplit,
  CheckCircle, BoxSeam, Capsule, ArrowLeftCircle, XCircle, Printer, Inbox,
  Search, ClockHistory, Funnel, XLg, InfoCircle, ExclamationTriangleFill,
  ChatLeftText, ArrowRepeat, PencilSquare, PersonVcard, ChatSquareText,
  CalendarRange, CurrencyDollar, PlusLg, HandIndexThumb,
  FileEarmarkMedicalFill, Toggle2Off, ExclamationCircleFill, Send,
  Check2Circle, CheckLg, GeoAlt, GeoAltFill, Clock, Floppy, PrinterFill,
  ArrowLeft, SortDown, SortUpAlt, Trash, TrashFill, Eye,
  ExclamationTriangle, InfoCircleFill, Telephone, ShieldLock,
} from "react-bootstrap-icons";

// Same glyphs as the bootstrap-icons font used in PharmacyWebResource_5.html
// (<i class="bi bi-...">), but rendered as inline SVG so they ship inside the
// JS bundle. The Power Apps player blocks external/font-file loading, so an
// icon *font* shows up as empty boxes there. Names are the bootstrap-icons
// dash-case names; to add an icon, import it above and add one line below.
const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string; style?: CSSProperties }>> = {
  "file-earmark-medical": FileEarmarkMedical,
  "file-earmark-medical-fill": FileEarmarkMedicalFill,
  "list-ul": ListUl,
  "cloud-arrow-up-fill": CloudArrowUpFill,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "arrow-clockwise": ArrowClockwise,
  "box-arrow-up-right": BoxArrowUpRight,
  "cloud-slash": CloudSlash,
  "check-circle-fill": CheckCircleFill,
  "x-circle-fill": XCircleFill,
  "journal-text": JournalText,
  "file-earmark-image": FileEarmarkImage,
  "hourglass-split": HourglassSplit,
  "check-circle": CheckCircle,
  "box-seam": BoxSeam,
  "capsule-pill": Capsule,
  "capsule": Capsule,
  "arrow-left-circle": ArrowLeftCircle,
  "arrow-left": ArrowLeft,
  "x-circle": XCircle,
  "printer": Printer,
  "printer-fill": PrinterFill,
  "inbox": Inbox,
  "search": Search,
  "clock-history": ClockHistory,
  "clock": Clock,
  "funnel": Funnel,
  "x-lg": XLg,
  "info-circle": InfoCircle,
  "exclamation-triangle-fill": ExclamationTriangleFill,
  "chat-left-text": ChatLeftText,
  "arrow-repeat": ArrowRepeat,
  "pencil-square": PencilSquare,
  "person-vcard": PersonVcard,
  "chat-square-text": ChatSquareText,
  "calendar-range": CalendarRange,
  "currency-dollar": CurrencyDollar,
  "plus-lg": PlusLg,
  "hand-index-thumb": HandIndexThumb,
  "toggle2-off": Toggle2Off,
  "exclamation-circle-fill": ExclamationCircleFill,
  "send": Send,
  "check2-circle": Check2Circle,
  "check-lg": CheckLg,
  "geo-alt": GeoAlt,
  "geo-alt-fill": GeoAltFill,
  "floppy": Floppy,
  "sort-down": SortDown,
  "sort-up-alt": SortUpAlt,
  "trash": Trash,
  "trash-fill": TrashFill,
  "eye": Eye,
  "exclamation-triangle": ExclamationTriangle,
  "shield-lock": ShieldLock,
  "info-circle-fill": InfoCircleFill,
  "telephone": Telephone,
};

interface IconProps {
  name?: string;
  className?: string;
  style?: CSSProperties;
  /** px number, or any CSS length. Defaults to 1.05em so the icon scales with the surrounding text. */
  size?: number | string;
  title?: string;
}

export default function Icon({ name, className, style, size = "1.05em", title }: IconProps) {
  if (!name) return null;
  // Accept both "bi-check-lg" (old prop style) and "check-lg"
  const clean = name.replace(/^bi\s+bi-/, "").replace(/^bi-/, "").trim();
  const Cmp = ICON_MAP[clean];

  if (!Cmp) {
    console.warn(`[Icon] no mapping for "${clean}" — showing placeholder`);
    return (
      <span
        className={className}
        title={title || clean}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          border: "1px dashed currentColor",
          opacity: 0.4,
          verticalAlign: "middle",
          ...style,
        }}
      />
    );
  }

  // The "bi bi-<name>" classes keep legacy selectors (e.g. ".search-wrap .bi-search")
  // working. -0.125em is the same vertical offset bootstrap-icons uses, so the icon
  // lines up with adjacent text; inside flex containers (buttons) it's centred anyway.
  return (
    <span
      title={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, lineHeight: 1, verticalAlign: "-0.125em" }}
    >
      <Cmp className={`bi bi-${clean}${className ? ` ${className}` : ""}`} style={style} size={size} />
    </span>
  );
}

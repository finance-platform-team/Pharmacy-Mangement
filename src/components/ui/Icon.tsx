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
  Check2Circle, CheckLg, GeoAlt, Clock, Floppy, PrinterFill, ArrowLeft,
  SortDown, SortUpAlt,
} from "react-bootstrap-icons";

// Maps bootstrap-icons dash-case names (e.g. "check-circle-fill") to the
// matching react-bootstrap-icons SVG component. If a build error says an
// import above "has no exported member", that specific icon's real export
// name differs — check the react-bootstrap-icons package and fix the
// import + this map entry, nothing else needs to change.
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; style?: CSSProperties }>> = {
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
  "floppy": Floppy,
  "sort-down": SortDown,
  "sort-up-alt": SortUpAlt,
};

interface IconProps {
  name?: string;
  className?: string;
  style?: CSSProperties;
  size?: number;
  title?: string;
}

export default function Icon({ name, className, style, size = 16, title }: IconProps) {
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

  return (
    <span title={title} style={{ display: "inline-flex" }}>
      <Cmp className={className} style={style} size={size} />
    </span>
  );
}
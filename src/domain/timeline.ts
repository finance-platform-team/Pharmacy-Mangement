import type { Visit } from "./types";

export interface TimelineStep {
  label: string;
  dt: string;
  time: string;
  user?: string;
}

/** "10:16 AM - 7/31/2026" style formatting, matching the old fm() helper. */
function formatStepTime(dt?: string): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${time} - ${d.toLocaleDateString()}`;
}

const STEP_PRIORITY: Record<string, number> = {
  Created: 1,
  Attended: 2,
  Pending: 3,
  Approved: 4,
  Preparing: 5,
  Dispensed: 6,
  Cancelled: 7,
};

/**
 * Builds the chronological history steps for a visit, mirroring the old
 * editTimelineList logic. Note: the "Preparing" step in the old file was
 * gated behind ARC-only business-unit checks — deferred here (Phase 11),
 * so Preparing always shows if a preparingTime exists.
 */
export function buildTimeline(visit: Visit): TimelineStep[] {
  const steps: TimelineStep[] = [];

  if (visit.orderDate) {
    steps.push({
      label: "Created",
      dt: visit.orderDate,
      time: formatStepTime(visit.orderDate),
      user: visit.createdBy,
    });
  }
  if (visit.attendedTime) {
    steps.push({
      label: "Attended",
      dt: visit.attendedTime,
      time: formatStepTime(visit.attendedTime),
      user: visit.attendedBy,
    });
  }
  if (visit.pendingTime) {
    steps.push({
      label: "Pending",
      dt: visit.pendingTime,
      time: formatStepTime(visit.pendingTime),
      user: visit.pendingBy,
    });
  }
  if (visit.preparingTime && (visit.status === "Preparing" || visit.status === "Dispensed")) {
    steps.push({
      label: "Preparing",
      dt: visit.preparingTime,
      time: formatStepTime(visit.preparingTime),
      user: visit.preparingBy,
    });
  }
  if (visit.approveTime) {
    steps.push({
      label: "Approved",
      dt: visit.approveTime,
      time: formatStepTime(visit.approveTime),
      user: visit.approvedBy,
    });
  }
  if (visit.dispenseTime) {
    steps.push({
      label: "Dispensed",
      dt: visit.dispenseTime,
      time: formatStepTime(visit.dispenseTime),
      user: visit.dispensedBy,
    });
  }
  if (visit.status === "Cancelled" && visit.modifiedOn) {
    steps.push({
      label: "Cancelled",
      dt: visit.modifiedOn,
      time: formatStepTime(visit.modifiedOn),
      user: visit.cancelledBy,
    });
  }

  steps.sort((a, b) => {
    const timeA = new Date(a.dt).getTime();
    const timeB = new Date(b.dt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (STEP_PRIORITY[a.label] || 0) - (STEP_PRIORITY[b.label] || 0);
  });

  // Deduplicate identical (label + timestamp) entries, same as old seen{} guard.
  const seen = new Set<string>();
  return steps.filter((s) => {
    const key = `${s.label}${s.dt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
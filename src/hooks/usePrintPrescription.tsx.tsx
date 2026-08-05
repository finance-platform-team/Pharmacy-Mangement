import { usePrint } from "../PrintContext";
import PrintShell from "../components/print/PrintShell";
import PrescriptionPrint from "../components/print/PrescriptionPrint";
import { fetchMedicationsForVisit } from "../api/medsApi";
import type { Visit } from "../domain/types";

interface PrintPrescriptionOptions {
  docType?: string;
  filterDiscontinued?: boolean;
}

export function usePrintPrescription() {
  const { requestPrint } = usePrint();

  async function printPrescription(visit: Visit, opts?: PrintPrescriptionOptions) {
    let visitToPrint = visit;

    // The Claims list (useVisits.ts) doesn't load medications up front —
    // that was a deliberate perf decision back in Phase 6. If they're
    // missing here, fetch them now before printing, the same way
    // AvailModal / UnavailMedsModal already do on demand.
    if (!visit.medications || visit.medications.length === 0) {
      try {
        const meds = await fetchMedicationsForVisit(visit.id);
        visitToPrint = { ...visit, medications: meds };
      } catch (err) {
        console.warn("Failed to fetch medications for print:", err);
      }
    }

    requestPrint(
      <PrintShell branchLabel={visitToPrint.buText}>
        <PrescriptionPrint
          visit={visitToPrint}
          docType={opts?.docType}
          filterDiscontinued={opts?.filterDiscontinued}
        />
      </PrintShell>,
    );
  }

  return { printPrescription };
}

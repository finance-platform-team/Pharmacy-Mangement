import { usePrint } from "../PrintContext";
import PrintShell from "../components/print/PrintShell";
import QueueTicketPrint from "../components/print/QueueTicketPrint";
import type { Visit } from "../domain/types";

/**
 * The queue number prints on the small ticket paper, not A4. This is the paper
 * size (width height) — match it to the roll in the printer: 80mm wide is the
 * usual ticket roll; use "58mm 90mm" for a 58mm roll.
 */
export const QUEUE_TICKET_PAGE_SIZE = "80mm 85mm";

export function usePrintQueue() {
  const { requestPrint } = usePrint();

  function printQueue(visit: Visit, queueNo: string) {
    requestPrint(
      <PrintShell branchLabel={visit.buText}>
        <QueueTicketPrint visit={visit} queueNo={queueNo} />
      </PrintShell>,
      { pageSize: QUEUE_TICKET_PAGE_SIZE },
    );
  }

  return { printQueue };
}

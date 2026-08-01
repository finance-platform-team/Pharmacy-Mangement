import { usePrint } from "../PrintContext";
import PrintShell from "../components/print/PrintShell";
import QueueTicketPrint from "../components/print/QueueTicketPrint";
import type { Visit } from "../domain/types";

export function usePrintQueue() {
  const { requestPrint } = usePrint();

  function printQueue(visit: Visit, queueNo: string) {
    requestPrint(
      <PrintShell branchLabel={visit.buText}>
        <QueueTicketPrint visit={visit} queueNo={queueNo} />
      </PrintShell>,
    );
  }

  return { printQueue };
}
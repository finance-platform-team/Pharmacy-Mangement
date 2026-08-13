import type { Crf79_visitses } from "../generated/models/Crf79_visitsesModel";

/**
 * The generated Crf79_visitses model doesn't declare the OData annotation
 * fields (formatted lookup display names). Dataverse returns them anyway
 * when the raw lookup field is in $select, but TypeScript doesn't know
 * about them. This extends the type so we can read them safely.
 *
 * See PROJECT_INSTRUCTIONS.md section 4-و for why these annotations exist
 * instead of plain "xxxname" properties on this particular table.
 */
export interface Crf79_visitsesRaw extends Crf79_visitses {
  "_new_bu_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_attendedby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_approvedby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_dispensedby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_cancelledby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_pendingby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_crf79_preparingby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_modifiedby_value@OData.Community.Display.V1.FormattedValue"?: string;
}
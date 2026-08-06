/**
 * domain/spAttachments.ts
 *
 * SharePoint-based attachments logic — replaces the old OneDrive iframe approach.
 * Ported 1:1 from the confirmed working implementation in LastPhamacy.html
 * (functions spFolderName, spFileAction, spListFiles, spDeleteFile, spPrintFile,
 * predictOneDriveLink, buildSpUploadZoneHTML, wireSpDropzone, refreshSpFileList).
 *
 * Internal names keep the "OneDrive" wording on purpose, matching the HTML —
 * only user-facing text says "Documents". See PROJECT_INSTRUCTIONS.md.
 */

// ✅ Real flow URL, copied verbatim from LastPhamacy.html
export const SP_FILE_FLOW_URL =
  "https://9ce6fb095b63e9f49185b707b4b342.5e.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/a55204ceb938470dbb6f8262df141070/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=1Js3T4Pz2LcqFIZgGUSMTkuRgmYHOp1i9Kaf504qKHM";

export interface SpFile {
  name: string;
  url: string;
  path: string; // real SharePoint Identifier — required for delete
  size: number;
}

/** Minimal visit shape the SharePoint flow needs. `id` must be the real Dataverse GUID. */
export interface SpAttachmentVisit {
  id: string;
  visitId?: string; // friendly reference number shown to users (VisitRef)
  buText?: string;
  patientName?: string;
  patientPhone?: string;
}

type SpAction = "upload" | "list" | "delete";

/** Falls back to the branch picked in the startup modal (same key useBusinessUnit persists to). */
function storedBuName(): string {
  if (typeof localStorage === "undefined") return "AAC";
  return localStorage.getItem("pharmacy_bu_name") || "AAC";
}

/** Payload passed to spFileAction for a delete call (mirrors the HTML's `{name, realPath}` shape) */
interface SpDeleteTarget {
  name: string;
  realPath: string;
}

/** Sanitize + build the SharePoint sub-folder name: "PatientName-Phone" */
export function spFolderName(v: SpAttachmentVisit): string {
  const pName = String(v.patientName || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const phone = String(v.patientPhone || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "")
    .trim();
  return `${pName}-${phone}`;
}

/** Build the "Open Folder" link directly (no waiting on a flow-generated link) */
export function predictOneDriveLink(v: SpAttachmentVisit): string {
  const bu = String(v.buText || storedBuName()).trim().toUpperCase();
  const folderName = spFolderName(v);
  const base =
    "https://andalusiagroupegypt.sharepoint.com/sites/DigitalTransformation/PharmacyDispensingApp/Forms/AllItems.aspx?id=";
  const idPath = `/sites/DigitalTransformation/PharmacyDispensingApp/${bu}/${folderName}`;
  const viewid = "2876e222-a41e-4165-bd4c-c2eb457e5f37";
  return base + encodeURIComponent(idPath) + "&viewid=" + viewid;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Low-level call to the single SharePoint attachments flow.
 * `file` is a real File for "upload", or a {name, realPath} object for "delete", or omitted for "list".
 */
export async function spFileAction(
  action: SpAction,
  visit: SpAttachmentVisit,
  file?: File | SpDeleteTarget | null,
): Promise<unknown> {
  const folderName = spFolderName(visit);
  let guidId = visit.id || "";
  if (typeof guidId === "string") guidId = guidId.replace(/[{}]/g, "");
  const refNum = visit.visitId || guidId;

  const isFile = typeof File !== "undefined" && file instanceof File;
  const fileName = file ? (file as File | SpDeleteTarget).name : "";

  const body: Record<string, string> = {
    action,
    folderName,
    VisitId: guidId,
    VisitRef: String(refNum),
    BUtext: String(visit.buText || storedBuName()).trim().toUpperCase(),
    fileName,
    fileContentBase64: "",
    filePath: isFile ? `${folderName}/${fileName}` : folderName,
    PatientName: visit.patientName || "",
    PatientPhone: visit.patientPhone || "",
    DeletedFile:
      action === "delete" && file && "realPath" in (file as SpDeleteTarget)
        ? (file as SpDeleteTarget).realPath
        : "",
  };

  if (action === "upload" && isFile) {
    body.fileContentBase64 = await fileToBase64(file as File);
  }

  const resp = await fetch(SP_FILE_FLOW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => String(resp.status));
    throw new Error(`SharePoint flow failed (${resp.status}): ${errText}`);
  }

  return resp.json().catch(() => null);
}

/** List files in the visit's SharePoint folder — flow returns a bare array (or {files:[]}/{value:[]}) */
export async function spListFiles(visit: SpAttachmentVisit): Promise<SpFile[]> {
  const data = await spFileAction("list", visit, null);
  if (Array.isArray(data)) return data as SpFile[];
  if (data && Array.isArray((data as { files?: SpFile[] }).files)) {
    return (data as { files: SpFile[] }).files;
  }
  if (data && Array.isArray((data as { value?: SpFile[] }).value)) {
    return (data as { value: SpFile[] }).value;
  }
  return [];
}

/** Upload a single file to the visit's SharePoint folder (folder auto-created by the flow) */
export async function spUploadFile(visit: SpAttachmentVisit, file: File): Promise<void> {
  await spFileAction("upload", visit, file);
}

/** Delete a file — `filePath` MUST be the real Identifier (`path`) returned by spListFiles */
export async function spDeleteFile(
  visit: SpAttachmentVisit,
  fileName: string,
  filePath: string,
): Promise<void> {
  await spFileAction("delete", visit, { name: fileName, realPath: filePath });
}

/** Print a file (image or PDF) in a brand-new tab — no iframe, real onload-triggered print */
export function spPrintFile(url: string, fileName?: string): boolean {
  const isPdf = /\.pdf($|\?)/i.test(fileName || url || "");
  const w = window.open("", "_blank");
  if (!w) return false; // caller should toast: "Please allow pop-ups"

  const doc = w.document;
  doc.open();
  if (isPdf) {
    doc.write(
      `<html><head><title>Print</title></head><body style="margin:0;">` +
        `<embed src="${url}" type="application/pdf" style="width:100vw;height:100vh;border:none;" ` +
        `onload="setTimeout(function(){ window.focus(); window.print(); }, 600);" />` +
        `</body></html>`,
    );
  } else {
    doc.write(
      `<html><head><title>Print</title><style>img{max-width:100%;height:auto;display:block;margin:auto;}</style></head>` +
        `<body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">` +
        `<img src="${url}" onload="window.focus(); setTimeout(function(){ window.print(); }, 200);" ` +
        `onerror="document.body.innerHTML='&lt;p style=&quot;font-family:sans-serif;padding:20px;&quot;&gt;Could not load file for printing. &lt;a href=&quot;${url}&quot; target=&quot;_blank&quot;&gt;Open it directly&lt;/a&gt;.&lt;/p&gt;';" />` +
        `</body></html>`,
    );
  }
  doc.close();
  return true;
}
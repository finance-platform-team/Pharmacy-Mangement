/**
 * domain/spAttachments.ts
 *
 * OneDrive-based attachments logic — replaces the old OneDrive iframe approach.
 * Ported 1:1 from the confirmed working "Documents" implementation in
 * PHWEBRESCOURCE.HTML (functions spFolderName, spFileAction, spListFiles,
 * spDeleteFile, spFetchFileDataUrl, buildSpUploadZoneHTML, wireSpDropzone,
 * refreshSpFileList). The folder link is read directly off the visit's
 * crf79_documents column — never predicted/constructed client-side.
 *
 * spFetchFileDataUrl deliberately returns a data: URI rather than a blob:
 * URL (unlike the HTML, which isn't sandboxed the same way) — the Power
 * Apps custom-page host's CSP (img-src 'self' data:) silently blocks blob:
 * resources, so blob: previews just hang forever with no visible error.
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

/** Blocked upload extensions — executables & dangerous types only. Everything
 * else (documents, images, and general files) is allowed, matching the
 * PHWEBRESCOURCE.HTML "Documents" dropzone policy. */
export const SP_BLOCKED_EXTENSIONS = [
  "exe", "apk", "msi", "msix", "bat", "cmd", "sh", "bash", "com", "scr",
  "dll", "jar", "vbs", "vbe", "js", "jse", "wsf", "wsh", "ps1", "psm1",
  "lnk", "cpl", "gadget", "msc", "app", "dmg", "pkg", "deb", "rpm",
  "reg", "inf", "iso", "bin", "run", "action", "workflow", "command",
];

export function spIsAllowedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return !SP_BLOCKED_EXTENSIONS.includes(ext);
}

/** "pdf" / "image" render inline; "other" (Word, Excel, PowerPoint, etc.) can't be shown in-browser. */
export function spFileKind(fileName?: string, url?: string): "pdf" | "image" | "other" {
  const name = (fileName || url || "").toLowerCase();
  if (/\.pdf($|\?)/.test(name)) return "pdf";
  if (/\.(jpe?g|png|gif|webp|bmp|tiff?|svg|heic|heif)($|\?)/.test(name)) return "image";
  return "other";
}

function spMimeTypeFromName(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
    svg: "image/svg+xml", pdf: "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

/** Triggers a real download from a data: URI (browsers can't display Office docs inline) */
export function spDownloadBlob(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName || "file";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Minimal visit shape the SharePoint flow needs. `id` must be the real Dataverse GUID. */
export interface SpAttachmentVisit {
  id: string;
  visitId?: string; // friendly reference number shown to users (VisitRef)
  buText?: string;
  patientName?: string;
  patientPhone?: string;
  /** The visit's crf79_documents column — the real OneDrive folder link, written by the
   * flow after the first upload. No client-side prediction; read straight off the record. */
  documentsLink?: string;
}

type SpAction = "upload" | "list" | "delete" | "download";

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
 * `file` is a real File for "upload", or a {name, realPath} object for "delete"/"download", or omitted for "list".
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
    filePath: file ? `${folderName}/${fileName}` : folderName,
    PatientName: visit.patientName || "",
    PatientPhone: visit.patientPhone || "",
    DeletedFile:
      (action === "delete" || action === "download") && file && "realPath" in (file as SpDeleteTarget)
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
    let message = errText;
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } };
      message = parsed?.error?.message || errText;
    } catch {
      // Not JSON — fall back to the raw text below.
    }
    if (message.length > 200) message = `${message.slice(0, 200)}…`;
    throw new Error(`SharePoint flow failed (${resp.status}): ${message}`);
  }

  return resp.json().catch(() => null);
}

/**
 * List files in the visit's OneDrive folder.
 * Ported 1:1 from PHWEBRESCOURCE.HTML's spListFiles: unwraps common wrapper
 * shapes ({body:[...]}, {files:[...]}, {value:[...]}), flattens one level in
 * case entries arrive grouped as nested arrays, then de-dupes — the flow has
 * been observed to return each file twice.
 */
export async function spListFiles(visit: SpAttachmentVisit): Promise<SpFile[]> {
  let raw: unknown = await spFileAction("list", visit, null).catch((err) => {
    // A "list" failure almost always just means the folder doesn't exist yet
    // (brand-new patient, never uploaded anything) — not a real error.
    console.warn("[spListFiles] treating failure as empty list:", (err as Error)?.message);
    return [];
  });

  if (raw && !Array.isArray(raw) && (raw as { body?: unknown }).body !== undefined) {
    raw = (raw as { body: unknown }).body;
  }
  if (raw && !Array.isArray(raw) && Array.isArray((raw as { files?: unknown[] }).files)) {
    raw = (raw as { files: unknown[] }).files;
  }
  if (raw && !Array.isArray(raw) && Array.isArray((raw as { value?: unknown[] }).value)) {
    raw = (raw as { value: unknown[] }).value;
  }
  if (!Array.isArray(raw)) return [];

  const flat: SpFile[] = [];
  for (const item of raw as unknown[]) {
    if (Array.isArray(item)) flat.push(...(item as SpFile[]));
    else if (item) flat.push(item as SpFile);
  }

  const seen = new Set<string>();
  const result: SpFile[] = [];
  for (const f of flat) {
    if (!f || !f.name) continue;
    const key = f.path || `${f.name}|${f.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(f);
  }
  return result;
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

/**
 * Fetches the file's actual bytes through our own flow (server-side, already
 * authenticated) and turns them into a data: URI. This deliberately does NOT
 * use blob: URLs (via URL.createObjectURL) — the Power Apps custom-page host
 * enforces a CSP of `img-src 'self' data:`, which silently blocks blob:
 * images/embeds (confirmed in production: previews hung forever with no
 * error, since the CSP violation just prevents the resource from loading).
 * data: URIs are explicitly allowed, so this is what actually works inside
 * that sandbox — same authenticated-fetch benefit, different container.
 */
export async function spFetchFileDataUrl(
  visit: SpAttachmentVisit,
  filePath: string,
  fileName: string,
): Promise<string> {
  const data = (await spFileAction("download", visit, { name: fileName, realPath: filePath })) as
    | { content?: string; Content?: string; base64?: string }
    | null;
  const b64 = data?.content || data?.Content || data?.base64;
  if (!b64) throw new Error("No file content returned by the flow");
  return `data:${spMimeTypeFromName(fileName)};base64,${b64}`;
}
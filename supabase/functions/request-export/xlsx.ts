import { generateXlsxFileSync } from "https://esm.sh/write-excel-file@4.1.1/modules/export/writeXlsxFileUniversal.js";
import convertFileContentToUint8Array from "https://esm.sh/write-excel-file@4.1.1/modules/export/convertFileContentToUint8ArrayUniversal.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type WorkbookCell = Record<string, unknown>;
type WorkbookRow = WorkbookCell[];
type WorkbookOptions = Record<string, unknown>;

export async function createExportWorkbookBlob(rows: WorkbookRow[], options: WorkbookOptions): Promise<Blob> {
  const blob = await generateXlsxFileSync(rows, options, undefined, convertFileContentToUint8Array);
  if (blob.type === XLSX_MIME) return blob;

  return new Blob([await blob.arrayBuffer()], { type: XLSX_MIME });
}

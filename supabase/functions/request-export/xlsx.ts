const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type WorkbookCell = Record<string, unknown>;
type WorkbookRow = WorkbookCell[];
type WorkbookOptions = Record<string, unknown>;

type UniversalWriterModule = {
  generateXlsxFileSync: (
    arg1: unknown,
    arg2: unknown,
    arg3: unknown,
    convertFileContentToUint8Array: (content: unknown) => Promise<Uint8Array> | Uint8Array,
  ) => Promise<Blob>;
};

type ContentConverterModule = {
  default: (content: unknown) => Promise<Uint8Array> | Uint8Array;
};

const isDenoRuntime = Boolean((globalThis as { Deno?: unknown }).Deno);

const universalWriterSpecifier = isDenoRuntime
  ? "https://esm.sh/write-excel-file@4.1.1/modules/export/writeXlsxFileUniversal.js"
  : "../../../node_modules/write-excel-file/modules/export/writeXlsxFileUniversal.js";

const contentConverterSpecifier = isDenoRuntime
  ? "https://esm.sh/write-excel-file@4.1.1/modules/export/convertFileContentToUint8ArrayUniversal.js"
  : "../../../node_modules/write-excel-file/modules/export/convertFileContentToUint8ArrayUniversal.js";

let modulePromise: Promise<{
  writer: UniversalWriterModule;
  converter: ContentConverterModule;
}> | null = null;

async function loadWorkbookModules() {
  modulePromise ??= Promise.all([
    import(universalWriterSpecifier) as Promise<UniversalWriterModule>,
    import(contentConverterSpecifier) as Promise<ContentConverterModule>,
  ]).then(([writer, converter]) => ({ writer, converter }));

  return modulePromise;
}

export async function createExportWorkbookBlob(rows: WorkbookRow[], options: WorkbookOptions): Promise<Blob> {
  const { writer, converter } = await loadWorkbookModules();

  const blob = await writer.generateXlsxFileSync(rows, options, undefined, converter.default);
  if (blob.type === XLSX_MIME) return blob;

  return new Blob([await blob.arrayBuffer()], { type: XLSX_MIME });
}

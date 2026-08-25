import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "https://esm.sh/write-excel-file@4.1.1/modules/export/writeXlsxFileUniversal.js": resolve(
        __dirname,
        "node_modules/write-excel-file/modules/export/writeXlsxFileUniversal.js",
      ),
      "https://esm.sh/write-excel-file@4.1.1/modules/export/convertFileContentToUint8ArrayUniversal.js": resolve(
        __dirname,
        "node_modules/write-excel-file/modules/export/convertFileContentToUint8ArrayUniversal.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["supabase/functions/**/*.{test,spec}.ts"],
  },
});

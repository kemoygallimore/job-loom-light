import { describe, expect, it } from "vitest";

import { createExportWorkbookBlob } from "./xlsx";

describe("createExportWorkbookBlob", () => {
  it("creates an XLSX blob when Worker is unavailable", async () => {
    const originalWorker = globalThis.Worker;
    class UnsupportedWorker {
      constructor() {
        throw new Error("Not implemented: Worker.prototype.constructor");
      }
    }

    try {
      Object.defineProperty(globalThis, "Worker", {
        configurable: true,
        value: UnsupportedWorker,
      });

      const rows = [
        [
          { type: String, value: "Candidate ID", fontWeight: "bold" },
          { type: String, value: "Name", fontWeight: "bold" },
          { type: String, value: "Notes", fontWeight: "bold" },
        ],
        ...Array.from({ length: 500 }, (_, index) => [
          { type: String, value: `candidate-${index + 1}` },
          { type: String, value: `Candidate ${index + 1}` },
          { type: String, value: `screening summary ${index + 1} `.repeat(40) },
        ]),
      ];

      const blob = await createExportWorkbookBlob(rows, {
        sheet: "Data",
        stickyRowsCount: 1,
        columns: [{ width: 24 }, { width: 18 }, { width: 48 }],
      });

      expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(blob.size).toBeGreaterThan(0);
      await expect(blob.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
    } finally {
      Object.defineProperty(globalThis, "Worker", {
        configurable: true,
        value: originalWorker,
      });
    }
  });
});

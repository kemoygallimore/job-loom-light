import { describe, expect, it } from "vitest";
import {
  applyInputMask,
  createField,
  getFileAccept,
  normalizeSchema,
  validateLeadFormFieldValue,
  validateUploadFile,
} from "./leadForms";

describe("lead form schema normalization", () => {
  it("adds defaults to legacy schemas", () => {
    const schema = normalizeSchema({
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "resume", type: "file", label: "Resume" },
      ],
    });

    expect(schema.theme).toBe("blue");
    expect(schema.fields[0].validation?.maskPreset).toBe("none");
    expect(schema.fields[0].style?.accent).toBe("default");
    expect(schema.fields[1].upload?.maxSizeMb).toBe(10);
    expect(schema.fields[1].upload?.allowedCategories).toEqual(["documents", "images"]);
  });

  it("keeps only valid field types and normalizes option fields", () => {
    const schema = normalizeSchema({
      theme: "green",
      fields: [
        { id: "choice", type: "select", label: "Choice", options: ["A", "", "B"] },
        { id: "bad", type: "unknown", label: "Bad" },
      ],
    });

    expect(schema.theme).toBe("green");
    expect(schema.fields).toHaveLength(1);
    expect(schema.fields[0].options).toEqual(["A", "B"]);
  });
});

describe("lead form validation helpers", () => {
  it("applies phone masks", () => {
    const field = createField("phone");
    expect(applyInputMask(field, "8765550198")).toBe("(876) 555-0198");
    expect(validateLeadFormFieldValue(field, "(876) abc-0198")).toBe("Complete the required format.");
  });

  it("validates character limits and confirmation values", () => {
    const field = {
      ...createField("email"),
      validation: { maxLength: 12, requireConfirmation: true },
    };

    expect(validateLeadFormFieldValue(field, "person@example.com", "person@example.com")).toBe(
      "Enter no more than 12 characters.",
    );
    expect(validateLeadFormFieldValue(field, "a@b.co", "other@b.co")).toBe("Confirmation must match.");
    expect(validateLeadFormFieldValue(field, "a@b.co", "a@b.co")).toBeNull();
  });

  it("validates file type and size rules per field", () => {
    const field = {
      ...createField("file"),
      upload: { maxSizeMb: 1, allowedCategories: ["documents"] },
    };
    const document = new File(["pdf"], "resume.pdf", { type: "application/pdf" });
    const image = new File(["png"], "photo.png", { type: "image/png" });
    const largeDocument = new File([new Uint8Array(2 * 1024 * 1024)], "large.pdf", {
      type: "application/pdf",
    });

    expect(getFileAccept(field)).toBe(".pdf,.doc,.docx");
    expect(validateUploadFile(document, field)).toBeNull();
    expect(validateUploadFile(image, field)).toBe("Upload a file type allowed for this field.");
    expect(validateUploadFile(largeDocument, field)).toBe("Files must be 1 MB or smaller.");
  });
});

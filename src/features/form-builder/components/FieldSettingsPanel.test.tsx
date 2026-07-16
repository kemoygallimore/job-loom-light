import { fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createField, normalizeSchema, type LeadFormField, type LeadFormSchema } from "@/lib/leadForms";
import { FieldSettingsPanel } from "./FieldSettingsPanel";

function OptionSettingsHarness({ onUpdateField }: { onUpdateField: (fieldId: string, patch: Partial<LeadFormField>) => void }) {
  const initialSchema = useMemo<LeadFormSchema>(() => {
    const field = createField("select");
    return normalizeSchema({
      fields: [
        {
          ...field,
          id: "choice",
          label: "Favorite option",
          options: ["Option 1", "Option 2"],
        },
      ],
    });
  }, []);
  const [schema, setSchema] = useState(initialSchema);
  const selectedField = schema.fields[0] ?? null;

  return (
    <FieldSettingsPanel
      schema={schema}
      selectedField={selectedField}
      updateField={(fieldId, patch) => {
        onUpdateField(fieldId, patch);
        setSchema((current) =>
          normalizeSchema({
            ...current,
            fields: current.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
          }),
        );
      }}
      moveField={() => {}}
      removeField={() => {}}
    />
  );
}

describe("FieldSettingsPanel option editing", () => {
  it("preserves raw spaces and blank lines while storing cleaned options", () => {
    const onUpdateField = vi.fn();
    render(<OptionSettingsHarness onUpdateField={onUpdateField} />);

    const optionsTextarea = screen.getAllByRole("textbox").at(-1) as HTMLTextAreaElement;
    fireEvent.change(optionsTextarea, { target: { value: "First \n\nSecond Choice" } });

    expect(optionsTextarea.value).toBe("First \n\nSecond Choice");
    expect(onUpdateField).toHaveBeenLastCalledWith("choice", { options: ["First", "Second Choice"] });

    fireEvent.blur(optionsTextarea);

    expect(optionsTextarea.value).toBe("First\nSecond Choice");
  });
});

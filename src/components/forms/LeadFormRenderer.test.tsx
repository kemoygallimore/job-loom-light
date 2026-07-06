import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LeadFormRenderer from "./LeadFormRenderer";
import { createField, LeadFormSchema } from "@/lib/leadForms";

describe("LeadFormRenderer file upload", () => {
  it("renders the upload card and selected file chip", () => {
    const fileField = createField("file");
    const schema: LeadFormSchema = { fields: [fileField] };
    const onChange = vi.fn();

    const { rerender } = render(
      <LeadFormRenderer schema={schema} values={{}} onChange={onChange} />,
    );

    expect(screen.getByText("Upload file")).toBeInTheDocument();
    expect(screen.getByText(/PDF, .DOC, .DOCX/i)).toBeInTheDocument();

    const file = new File(["content"], "trn-card.png", { type: "image/png" });
    rerender(<LeadFormRenderer schema={schema} values={{ [fileField.id]: file }} onChange={onChange} />);

    expect(screen.getByText("trn-card.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove trn-card\.png/i }));
    expect(onChange).toHaveBeenCalledWith(fileField, null);
  });
});

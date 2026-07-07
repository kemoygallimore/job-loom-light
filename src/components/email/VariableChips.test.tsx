import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariableChips } from "./VariableChips";

describe("VariableChips", () => {
  it("displays brace tokens but passes raw variable names to onInsert", () => {
    const onInsert = vi.fn();

    render(<VariableChips variables={["candidate_name"]} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: "{{candidate_name}}" }));

    expect(onInsert).toHaveBeenCalledWith("candidate_name");
  });
});

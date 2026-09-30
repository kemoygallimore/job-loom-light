import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PublicJobMetadata from "./PublicJobMetadata";

describe("PublicJobMetadata", () => {
  it("renders labeled location and employment metadata", () => {
    render(<PublicJobMetadata location="Remote" employmentType="contract" />);

    expect(screen.getByText("Location:")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("Employment type:")).toBeInTheDocument();
    expect(screen.getByText("Contract")).toBeInTheDocument();
  });

  it("renders the legacy fallback for missing metadata", () => {
    render(<PublicJobMetadata location={null} employmentType={null} />);

    expect(screen.getAllByText("Not specified")).toHaveLength(2);
  });
});

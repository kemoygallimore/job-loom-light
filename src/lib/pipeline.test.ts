import { describe, expect, it } from "vitest";
import {
  mapActivePipelineApplications,
  reconcilePipelineSelection,
  type PipelineApplication,
  type PipelineApplicationRow,
} from "./pipeline";

function row(overrides: Partial<PipelineApplicationRow>): PipelineApplicationRow {
  return {
    id: "app_1",
    job_id: "job_1",
    candidate_id: "candidate_1",
    stage: "applied",
    company_id: "company_1",
    candidates: { name: "Alicia Robinson", email: "alicia@example.com" },
    jobs: { title: "Marketing Specialist", hiring_manager: null, status: "open" },
    ...overrides,
  };
}

describe("pipeline helpers", () => {
  it("maps only applications attached to open jobs", () => {
    const mapped = mapActivePipelineApplications([
      row({ id: "open_app", jobs: { title: "Open job", hiring_manager: "Kemoy", status: "open" } }),
      row({ id: "closed_app", jobs: { title: "Closed job", hiring_manager: null, status: "closed" } }),
      row({ id: "missing_job", jobs: null }),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: "open_app",
      job: { title: "Open job", hiring_manager: "Kemoy", status: "open" },
      candidate: { name: "Alicia Robinson", email: "alicia@example.com" },
    });
  });

  it("removes selected rows and drawers that are no longer visible", () => {
    const visible = [
      { id: "app_1" },
      { id: "app_2" },
    ] as PipelineApplication[];

    const reconciled = reconcilePipelineSelection(visible, ["app_1", "closed_app"], { id: "closed_app" } as PipelineApplication);

    expect(reconciled.selectedIds).toEqual(["app_1"]);
    expect(reconciled.selectedApp).toBeNull();
  });

  it("keeps an open drawer synchronized to the latest visible row", () => {
    const latest = { id: "app_2", stage: "offer" } as PipelineApplication;
    const reconciled = reconcilePipelineSelection(
      [{ id: "app_1" }, latest] as PipelineApplication[],
      [],
      { id: "app_2", stage: "applied" } as PipelineApplication,
    );

    expect(reconciled.selectedApp).toBe(latest);
  });
});

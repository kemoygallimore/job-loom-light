import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewScorecardSettings from "./InterviewScorecardSettings";

interface VersionRow {
  id: string;
  company_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  created_by: string;
}

interface AreaRow {
  id: string;
  version_id: string;
  position: number;
  label: string;
  description: string | null;
}

const state = vi.hoisted(() => ({
  versions: [] as VersionRow[],
  areas: [] as AreaRow[],
  areaInsertPayloads: [] as Array<Record<string, unknown>[]>,
  nextVersionId: 2,
  nextAreaId: 1,
  areaSelectErrorVersionId: null as string | null,
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const filters: Record<string, unknown> = {};
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let payload: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
    let statuses: string[] | null = null;

    const matchingVersions = () =>
      state.versions
        .filter((row) => !filters.company_id || row.company_id === filters.company_id)
        .filter((row) => !filters.id || row.id === filters.id)
        .filter((row) => !filters.status || row.status === filters.status)
        .filter((row) => !statuses || statuses.includes(row.status))
        .sort((left, right) => right.version - left.version);

    const matchingAreas = () =>
      state.areas
        .filter((row) => !filters.version_id || row.version_id === filters.version_id)
        .sort((left, right) => left.position - right.position);

    const execute = () => {
      if (table === "interview_scorecard_versions") {
        if (operation === "select") return { data: matchingVersions(), error: null };

        if (operation === "update") {
          state.versions = state.versions.map((row) =>
            (!filters.id || row.id === filters.id)
              ? { ...row, ...(payload as Partial<VersionRow>) }
              : row,
          );
          return { data: null, error: null };
        }

        if (operation === "insert") {
          const row = {
            id: `version-${state.nextVersionId++}`,
            status: "draft" as const,
            ...(payload as Omit<VersionRow, "id" | "status">),
          };
          state.versions.push(row);
          return { data: row, error: null };
        }
      }

      if (table === "interview_scorecard_areas") {
        if (operation === "select") {
          if (filters.version_id === state.areaSelectErrorVersionId) {
            return { data: null, error: { message: "network unavailable" } };
          }
          return { data: matchingAreas(), error: null };
        }

        if (operation === "delete") {
          state.areas = state.areas.filter((row) => row.version_id !== filters.version_id);
          return { data: null, error: null };
        }

        if (operation === "insert") {
          const rows = payload as Array<Record<string, unknown>>;
          state.areaInsertPayloads.push(rows);
          const duplicate = rows.find(
            (row) => row.id && state.areas.some((area) => area.id === row.id),
          );
          if (duplicate) {
            return {
              data: null,
              error: {
                message:
                  'duplicate key value violates unique constraint "interview_scorecard_areas_pkey"',
              },
            };
          }

          state.areas.push(
            ...rows.map((row) => ({
              ...(row as Omit<AreaRow, "id">),
              id: (row.id as string | undefined) ?? `db-area-${state.nextAreaId++}`,
            })),
          );
          return { data: null, error: null };
        }
      }

      return { data: null, error: null };
    };

    const query = {
      select: vi.fn(() => {
        if (operation !== "insert") operation = "select";
        return query;
      }),
      insert: vi.fn((nextPayload: Record<string, unknown> | Array<Record<string, unknown>>) => {
        operation = "insert";
        payload = nextPayload;
        return query;
      }),
      update: vi.fn((nextPayload: Record<string, unknown>) => {
        operation = "update";
        payload = nextPayload;
        return query;
      }),
      delete: vi.fn(() => {
        operation = "delete";
        return query;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return query;
      }),
      in: vi.fn((_column: string, values: string[]) => {
        statuses = values;
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => {
        const result = execute();
        const rows = result.data as unknown[] | null;
        return { ...result, data: rows?.[0] ?? null };
      }),
      single: vi.fn(async () => execute()),
      then: (
        resolve: (value: ReturnType<typeof execute>) => void,
        reject: (reason?: unknown) => void,
      ) => Promise.resolve(execute()).then(resolve, reject),
    };

    return query;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => makeQuery(table)),
    },
  };
});

function seedPublishedScorecard() {
  state.versions = [
    {
      id: "version-1",
      company_id: "company-1",
      version: 1,
      status: "published",
      created_by: "user-1",
    },
  ];
  state.areas = [
    {
      id: "area-communication",
      version_id: "version-1",
      position: 0,
      label: "Communication",
      description: null,
    },
    {
      id: "area-confidence",
      version_id: "version-1",
      position: 1,
      label: "Confidence",
      description: null,
    },
  ];
}

describe("InterviewScorecardSettings", () => {
  beforeEach(() => {
    state.areaInsertPayloads = [];
    state.nextVersionId = 2;
    state.nextAreaId = 1;
    state.areaSelectErrorVersionId = null;
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it("publishes edits as a new version with database-generated area ids", async () => {
    seedPublishedScorecard();
    const onPublished = vi.fn();

    render(
      <InterviewScorecardSettings
        companyId="company-1"
        userId="user-1"
        onPublished={onPublished}
      />,
    );

    fireEvent.change(await screen.findByDisplayValue("Confidence"), {
      target: { value: "Executive presence" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish scorecard" }));

    await waitFor(() => expect(state.areaInsertPayloads).toHaveLength(1));
    expect(state.areaInsertPayloads[0]).toEqual([
      {
        version_id: "version-2",
        position: 0,
        label: "Communication",
        description: null,
      },
      {
        version_id: "version-2",
        position: 1,
        label: "Executive presence",
        description: null,
      },
    ]);
    await waitFor(() => expect(onPublished).toHaveBeenCalledOnce());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("recovers the prior areas when an interrupted publish left an empty draft", async () => {
    seedPublishedScorecard();
    state.versions[0].status = "archived";
    state.versions.push({
      id: "version-2",
      company_id: "company-1",
      version: 2,
      status: "draft",
      created_by: "user-1",
    });

    render(
      <InterviewScorecardSettings companyId="company-1" userId="user-1" />,
    );

    expect(await screen.findByDisplayValue("Communication")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Confidence")).toBeInTheDocument();
  });

  it("does not replace draft areas with archived content when loading the draft fails", async () => {
    seedPublishedScorecard();
    state.versions[0].status = "archived";
    state.versions.push({
      id: "version-2",
      company_id: "company-1",
      version: 2,
      status: "draft",
      created_by: "user-1",
    });
    state.areas.push(
      {
        id: "draft-area-communication",
        version_id: "version-2",
        position: 0,
        label: "Draft communication",
        description: null,
      },
      {
        id: "draft-area-confidence",
        version_id: "version-2",
        position: 1,
        label: "Draft confidence",
        description: null,
      },
    );
    state.areaSelectErrorVersionId = "version-2";

    render(
      <InterviewScorecardSettings companyId="company-1" userId="user-1" />,
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("network unavailable"));
    expect(screen.queryByDisplayValue("Communication")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Draft communication")).not.toBeInTheDocument();
  });
});

/**
 * FE-5: OverviewPage — validator summary badge + artifact replay + StatusView 래핑 검증.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ValidatorSummary } from "@/pages/overview/types";

// -- 모킹 --

const mockUseStatus = vi.fn();
vi.mock("@/api/hooks", () => ({ useStatus: (...args: unknown[]) => mockUseStatus(...args) }));

vi.mock("@/i18n", () => ({
  useT: () => (key: string, p?: Record<string, unknown>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

vi.mock("@/utils/classify", () => ({ classify_agent: () => "idle" }));
vi.mock("@/components/skeleton-grid", () => ({ SkeletonGrid: () => <div data-testid="skeleton" /> }));
vi.mock("@/components/empty-state", () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

import OverviewPage from "@/pages/overview/index";

function make_base(overrides: Record<string, unknown> = {}) {
  return {
    now: "2026-01-01T00:00:00.000Z",
    agents: [],
    tasks: [],
    ...overrides,
  };
}

function wrap(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());

// -- StatusView 래핑 --

describe("OverviewPage — StatusView 래핑 (FE-5)", () => {
  it("isLoading=true -> loading 상태 (SkeletonGrid)", () => {
    mockUseStatus.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    wrap(<OverviewPage />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("error -> error 상태", () => {
    mockUseStatus.mockReturnValue({ data: undefined, isLoading: false, error: new Error("fail"), refetch: vi.fn() });
    wrap(<OverviewPage />);
    expect(screen.getByText("status.error")).toBeInTheDocument();
  });

  it("data=undefined + no error -> empty 상태", () => {
    mockUseStatus.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    wrap(<OverviewPage />);
    expect(screen.getByText("overview.no_data")).toBeInTheDocument();
  });

  it("data present -> success (overview 콘텐츠 렌더)", () => {
    mockUseStatus.mockReturnValue({ data: make_base(), isLoading: false, error: null, refetch: vi.fn() });
    wrap(<OverviewPage />);
    expect(screen.getByText("overview.messages")).toBeInTheDocument();
  });
});

// -- Validator summary badge --

describe("OverviewPage — validator summary badge (FE-5)", () => {
  it("validator_summary 없으면 'validator_none' badge", () => {
    mockUseStatus.mockReturnValue({ data: make_base(), isLoading: false, error: null, refetch: vi.fn() });
    wrap(<OverviewPage />);
    expect(screen.getByTestId("validator-summary")).toBeInTheDocument();
    expect(screen.getByText("overview.validator_none")).toBeInTheDocument();
  });

  it("모두 통과하면 'all_passed' badge (variant=ok)", () => {
    const summary: ValidatorSummary = {
      repo_id: "clean-repo",
      total_validators: 2,
      passed_validators: 2,
      failed_validators: [],
      created_at: "2026-01-01",
    };
    mockUseStatus.mockReturnValue({
      data: make_base({ validator_summary: summary }),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    wrap(<OverviewPage />);
    expect(screen.getByText("overview.validator_all_passed")).toBeInTheDocument();
    expect(screen.getByText("clean-repo")).toBeInTheDocument();
  });

  it("실패 있으면 'failed_fmt' badge (variant=err) + 상세 목록", () => {
    const summary: ValidatorSummary = {
      repo_id: "fail-repo",
      total_validators: 3,
      passed_validators: 1,
      failed_validators: [
        { kind: "test", command: "vitest run", output: "2 failed" },
        { kind: "lint", command: "eslint ." },
      ],
      created_at: "2026-01-01",
    };
    mockUseStatus.mockReturnValue({
      data: make_base({ validator_summary: summary }),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    wrap(<OverviewPage />);
    // failed_fmt with count=2
    expect(screen.getByText(/overview\.validator_failed_fmt/)).toBeInTheDocument();
    // 상세 목록
    expect(screen.getByText(/vitest run/)).toBeInTheDocument();
    expect(screen.getByText(/eslint/)).toBeInTheDocument();
  });
});

// -- Artifact replay --

describe("OverviewPage — artifact replay entry point (FE-5)", () => {
  it("artifact_bundle_id 없으면 replay 섹션 미렌더", () => {
    const summary: ValidatorSummary = {
      repo_id: "repo",
      total_validators: 1,
      passed_validators: 1,
      failed_validators: [],
      created_at: "2026-01-01",
    };
    mockUseStatus.mockReturnValue({
      data: make_base({ validator_summary: summary }),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    wrap(<OverviewPage />);
    expect(screen.queryByTestId("artifact-replay")).toBeNull();
  });

  it("artifact_bundle_id 있으면 replay 섹션 렌더 + bundle ID 표시", () => {
    const summary: ValidatorSummary = {
      repo_id: "repo",
      total_validators: 1,
      passed_validators: 1,
      failed_validators: [],
      artifact_bundle_id: "bundle-abc-123",
      created_at: "2026-01-01",
    };
    mockUseStatus.mockReturnValue({
      data: make_base({ validator_summary: summary }),
      isLoading: false, error: null, refetch: vi.fn(),
    });
    wrap(<OverviewPage />);
    expect(screen.getByTestId("artifact-replay")).toBeInTheDocument();
    expect(screen.getByText("bundle-abc-123")).toBeInTheDocument();
    expect(screen.getByText("repo.artifact_replay")).toBeInTheDocument();
  });
});

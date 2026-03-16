/**
 * RPF-4F: OverviewPage — validator 실패 섹션 조건부 렌더 검증.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ValidatorSummary } from "@/pages/overview/types";

// ── 모듈 모킹 ──────────────────────────────────────────────────────────────────

const mockUseStatus = vi.fn();
vi.mock("@/api/hooks", () => ({ useStatus: (...args: unknown[]) => mockUseStatus(...args) }));

vi.mock("@/i18n", () => ({ useT: () => (key: string) => key }));

vi.mock("@/utils/classify", () => ({ classify_agent: () => "idle" }));
vi.mock("@/components/skeleton-grid", () => ({ SkeletonGrid: () => null }));

// ── 테스트 대상 ────────────────────────────────────────────────────────────────

import OverviewPage from "@/pages/overview/index";

function make_base_state(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ── validator 실패 섹션 ────────────────────────────────────────────────────────

describe("OverviewPage — validator 실패 섹션 조건부 렌더", () => {
  it("validator_summary 없으면 validator 섹션 미렌더", () => {
    mockUseStatus.mockReturnValue({ data: make_base_state(), isLoading: false });
    wrap(<OverviewPage />);
    expect(screen.queryByText("overview.validator_summary")).toBeNull();
  });

  it("failed_validators 빈 배열이면 validator 섹션 미렌더", () => {
    const summary: ValidatorSummary = {
      repo_id: "clean-repo",
      total_validators: 2,
      passed_validators: 2,
      failed_validators: [],
      created_at: "2026-01-01T00:00:00.000Z",
    };
    mockUseStatus.mockReturnValue({
      data: make_base_state({ validator_summary: summary }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    // 실패 없으면 overview에서 validator 섹션 숨김
    expect(screen.queryByText("overview.validator_summary")).toBeNull();
  });

  it("failed_validators 있으면 validator 섹션 + repo_id 렌더", () => {
    const summary: ValidatorSummary = {
      repo_id: "failing-repo",
      total_validators: 3,
      passed_validators: 1,
      failed_validators: [
        { kind: "test", command: "vitest run", output: "2 failed" },
        { kind: "typecheck", command: "tsc --noEmit" },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
    };
    mockUseStatus.mockReturnValue({
      data: make_base_state({ validator_summary: summary }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    expect(screen.getByText("overview.validator_summary")).toBeInTheDocument();
    expect(screen.getByText("failing-repo")).toBeInTheDocument();
  });

  it("failed_validators 있으면 배지에 실패 count 포함", () => {
    const summary: ValidatorSummary = {
      repo_id: "repo",
      total_validators: 3,
      passed_validators: 1,
      failed_validators: [
        { kind: "test", command: "vitest run" },
        { kind: "lint", command: "eslint ." },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
    };
    mockUseStatus.mockReturnValue({
      data: make_base_state({ validator_summary: summary }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    expect(screen.getByText("2 failed")).toBeInTheDocument();
  });

  it("isLoading=true → 스켈레톤 렌더 (validator 섹션 없음)", () => {
    mockUseStatus.mockReturnValue({ data: undefined, isLoading: true });
    wrap(<OverviewPage />);
    expect(screen.queryByText("overview.validator_summary")).toBeNull();
  });
});

// ── OB-7: Observability 배지 ────────────────────────────────────────────────

describe("OverviewPage — Observability 배지 (OB-7)", () => {
  it("observability 없으면 배지 미렌더", () => {
    mockUseStatus.mockReturnValue({ data: make_base_state(), isLoading: false });
    wrap(<OverviewPage />);
    expect(screen.queryByTestId("observability-badges")).toBeNull();
  });

  it("observability.error_rate.total=0이면 배지 미렌더", () => {
    mockUseStatus.mockReturnValue({
      data: make_base_state({
        observability: { error_rate: { total: 0, errors: 0, rate: 0 }, failure_summary: [], latency_summary: [], delivery_mismatch: [], provider_usage: [] },
      }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    expect(screen.queryByTestId("observability-badges")).toBeNull();
  });

  it("observability 있으면 error rate 배지 렌더", () => {
    mockUseStatus.mockReturnValue({
      data: make_base_state({
        observability: { error_rate: { total: 50, errors: 3, rate: 0.06 }, failure_summary: [], latency_summary: [], delivery_mismatch: [], provider_usage: [] },
      }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    expect(screen.getByTestId("observability-badges")).toBeInTheDocument();
    expect(screen.getByText("6.0%")).toBeInTheDocument();
    expect(screen.getByText("overview.error_rate")).toBeInTheDocument();
  });

  it("active_runs > 0이면 active runs 카드 렌더", () => {
    mockUseStatus.mockReturnValue({
      data: make_base_state({
        channels: { active_runs: 2 },
        observability: { error_rate: { total: 10, errors: 0, rate: 0 }, failure_summary: [], latency_summary: [], delivery_mismatch: [], provider_usage: [] },
      }),
      isLoading: false,
    });
    wrap(<OverviewPage />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("overview.active_runs")).toBeInTheDocument();
  });
});

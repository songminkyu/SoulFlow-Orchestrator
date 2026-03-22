/**
 * EV-4/5 FE: EvalPanel 조건부 렌더 + 번들 선택 테스트.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// api mock
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock("@/api/client", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
}));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/badge", () => ({ Badge: ({ status }: { status: string }) => <span>{status}</span> }));
vi.mock("@/components/section-header", () => ({
  SectionHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => <div>{title}{children}</div>,
}));
vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, locale: "en", set_locale: vi.fn() }),
}));
vi.mock("@/components/studio-model-picker", () => ({
  StudioModelPicker: ({
    value,
    onChange,
  }: {
    value: { provider_id: string; model: string };
    onChange: (v: { provider_id: string; model: string }) => void;
  }) => (
    <input
      data-testid="eval-model-picker"
      value={`${value.provider_id}:${value.model}`}
      onChange={(e) => {
        const [provider_id, model] = e.target.value.split(":");
        onChange({ provider_id: provider_id ?? "", model: model ?? "" });
      }}
    />
  ),
}));

import { EvalPanel } from "@/pages/prompting/eval-panel";

const storage: Record<string, string> = {};
beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(storage).forEach(k => delete storage[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  });
});

describe("EvalPanel", () => {
  it("초기 상태 — Load 버튼 렌더", () => {
    render(<EvalPanel />);
    expect(screen.getByText("prompting.eval_load")).toBeInTheDocument();
  });

  it("Load 클릭 → 번들 목록 렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: ["routing.json"] },
      { name: "safety", description: "Safety tests", smoke: true, dataset_files: ["safety.json"] },
    ]);
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => {
      expect(screen.getByText("routing")).toBeInTheDocument();
      expect(screen.getByText("safety")).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith("/api/eval/bundles");
  });

  it("번들 선택 → Run 버튼 렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    expect(screen.getByText("prompting.eval_run")).toBeInTheDocument();
  });

  it("Run 클릭 → scorecard 렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: {
        dataset: "routing", timestamp: "2026-01-01", total: 2, passed: 1, failed: 1,
        duration_ms: 100,
        scorecards: [
          { case_id: "c1", entries: [{ dimension: "overall", passed: true, score: 1 }], overall_passed: true, overall_score: 1 },
          { case_id: "c2", entries: [{ dimension: "overall", passed: false, score: 0 }], overall_passed: false, overall_score: 0 },
        ],
      },
      summaries: [{ dataset: "routing", total: 2, passed: 1, failed: 1, error_count: 0, duration_ms: 100 }],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => {
      expect(screen.getByTestId("eval-scorecard")).toBeInTheDocument();
      expect(screen.getByText("c1")).toBeInTheDocument();
      expect(screen.getByText("c2")).toBeInTheDocument();
    });
    expect(mockPost).toHaveBeenCalledWith("/api/eval/run", { bundle: "routing" });
  });

  it("Save as Baseline 클릭 → localStorage 저장", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: {
        dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0,
        duration_ms: 50,
        scorecards: [
          { case_id: "c1", entries: [{ dimension: "overall", passed: true, score: 1 }], overall_passed: true, overall_score: 1 },
        ],
      },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    fireEvent.click(screen.getByText("prompting.eval_save_baseline"));
    expect(localStorage.getItem("eval_baseline_routing")).not.toBeNull();
  });

  it("baseline 저장 후 재실행 → diff 섹션 + Update Baseline 렌더", async () => {
    // 1차 실행: score 0.8
    const report1 = {
      dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0,
      duration_ms: 50,
      scorecards: [
        { case_id: "c1", entries: [{ dimension: "overall", passed: true, score: 0.8 }], overall_passed: true, overall_score: 0.8 },
      ],
    };
    // 2차 실행: score 1.0 (개선)
    const report2 = {
      dataset: "routing", timestamp: "2026-01-02", total: 1, passed: 1, failed: 0,
      duration_ms: 40,
      scorecards: [
        { case_id: "c1", entries: [{ dimension: "overall", passed: true, score: 1 }], overall_passed: true, overall_score: 1 },
      ],
    };

    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost
      .mockResolvedValueOnce({ report: report1, summaries: [] })
      .mockResolvedValueOnce({ report: report2, summaries: [] });

    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));

    // 1차 실행 + baseline 저장
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    fireEvent.click(screen.getByText("prompting.eval_save_baseline"));
    expect(localStorage.getItem("eval_baseline_routing")).not.toBeNull();

    // 2차 실행 → diff 표시
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-baseline-diff"));
    expect(screen.getByText("prompting.eval_update_baseline")).toBeInTheDocument();
    expect(screen.getAllByText(/improved/).length).toBeGreaterThan(0);
  });

  it("번들 전환 시 result/baseline/diff 초기화", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route", smoke: true, dataset_files: [] },
      { name: "safety", description: "Safety", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: { dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0, duration_ms: 50, scorecards: [] },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    // bundle 전환
    fireEvent.click(screen.getByText("safety"));
    expect(screen.queryByTestId("eval-scorecard")).toBeNull();
  });

  it("QC-4: compiler_verdict=pass 있는 scorecard에 compiler badge 렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: {
        dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0,
        duration_ms: 50,
        scorecards: [
          {
            case_id: "c1",
            entries: [{ dimension: "overall", passed: true, score: 1 }],
            overall_passed: true,
            overall_score: 1,
            compiler_verdict: "pass",
            direct_node_hint: "use direct node",
          },
        ],
      },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    expect(screen.getByTestId("eval-compiler-badge")).toBeInTheDocument();
    expect(screen.getByTestId("eval-compiler-badge").textContent).toContain("PASS");
  });

  it("QC-4: compiler_verdict=fail → fail badge 렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: {
        dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 0, failed: 1,
        duration_ms: 50,
        scorecards: [
          {
            case_id: "c1",
            entries: [{ dimension: "overall", passed: false, score: 0 }],
            overall_passed: false,
            overall_score: 0,
            compiler_verdict: "fail",
          },
        ],
      },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    const badge = screen.getByTestId("eval-compiler-badge");
    expect(badge.className).toContain("ps-chip--score-err");
    expect(badge.textContent).toContain("FAIL");
  });

  it("compiler_verdict 없으면 compiler badge 미렌더", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: {
        dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0,
        duration_ms: 50,
        scorecards: [
          { case_id: "c1", entries: [{ dimension: "overall", passed: true, score: 1 }], overall_passed: true, overall_score: 1 },
        ],
      },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));
    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => screen.getByTestId("eval-scorecard"));
    expect(screen.queryAllByTestId("eval-compiler-badge")).toHaveLength(0);
  });

  it("엔드포인트 선택 시 api.post에 provider_id 포함", async () => {
    mockGet.mockResolvedValue([
      { name: "routing", description: "Route tests", smoke: true, dataset_files: [] },
    ]);
    mockPost.mockResolvedValue({
      report: { dataset: "routing", timestamp: "2026-01-01", total: 1, passed: 1, failed: 0, duration_ms: 50, scorecards: [] },
      summaries: [],
    });
    render(<EvalPanel />);
    fireEvent.click(screen.getByText("prompting.eval_load"));
    await waitFor(() => screen.getByText("routing"));
    fireEvent.click(screen.getByText("routing"));

    // Select endpoint
    const picker = screen.getByTestId("eval-model-picker");
    fireEvent.change(picker, { target: { value: "openai:gpt-4" } });

    fireEvent.click(screen.getByText("prompting.eval_run"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/eval/run", {
        bundle: "routing",
        provider_id: "openai",
        model: "gpt-4",
      });
    });
  });
});

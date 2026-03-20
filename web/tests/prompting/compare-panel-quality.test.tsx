/**
 * QC-2 / QC-3: ComparePanel — per-cell rubric 배지 + route 배지 테스트.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPost = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/i18n", () => ({
  useT: () => (k: string) => k,
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
      data-testid="model-picker"
      value={`${value.provider_id}:${value.model}`}
      onChange={(e) => {
        const [provider_id, model] = e.target.value.split(":");
        onChange({ provider_id: provider_id ?? "", model: model ?? "" });
      }}
    />
  ),
}));

import { ComparePanel } from "@/pages/prompting/compare-panel";

function base_result(overrides: Record<string, unknown> = {}) {
  return {
    content: "hi",
    finish_reason: "stop",
    latency_ms: 300,
    usage: { total_tokens: 50 },
    model: "gpt-4",
    provider_id: "openai",
    ok: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper: render ComparePanel, set both pickers + enter prompt text, then click Compare button.
 */
async function render_and_run(results: unknown[]) {
  mockPost.mockResolvedValue(results);

  const { container } = render(<ComparePanel />);

  // Set provider IDs
  const pickers = container.querySelectorAll("[data-testid='model-picker']");
  fireEvent.change(pickers[0], { target: { value: "openai:gpt-4" } });
  fireEvent.change(pickers[1], { target: { value: "anthropic:claude-3" } });

  // Enter a prompt (button is disabled without prompt text)
  const textarea = container.querySelector(".ps-prompt-area.ps-prompt-area--grow");
  if (textarea) fireEvent.change(textarea, { target: { value: "test prompt" } });

  // Find the Compare run button by class to avoid ambiguity
  const run_btn = container.querySelector(".ps-run-btn-main");
  if (run_btn) fireEvent.click(run_btn);

  return container;
}

describe("ComparePanel — QC-2 rubric 배지 per cell", () => {
  it("compare 결과에 rubric_verdict.overall=pass 있으면 PASS 배지 렌더", async () => {
    await render_and_run([
      base_result({ rubric_verdict: { overall: "pass" } }),
      base_result({ provider_id: "anthropic", model: "claude-3" }),
    ]);

    await waitFor(() => {
      expect(screen.getAllByTestId("compare-rubric-badge").length).toBeGreaterThanOrEqual(1);
    });
    const badges = screen.getAllByTestId("compare-rubric-badge");
    expect(badges[0].textContent).toContain("PASS");
  });

  it("compare 결과에 rubric_verdict.overall=fail 있으면 FAIL 배지 렌더", async () => {
    await render_and_run([
      base_result({ rubric_verdict: { overall: "fail" } }),
      base_result({ provider_id: "anthropic", model: "claude-3" }),
    ]);

    await waitFor(() => {
      expect(screen.getAllByTestId("compare-rubric-badge").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByTestId("compare-rubric-badge")[0].textContent).toContain("FAIL");
  });

  it("rubric_verdict 없으면 compare 배지 미렌더", async () => {
    await render_and_run([
      base_result(),
      base_result({ provider_id: "anthropic", model: "claude-3" }),
    ]);

    await waitFor(() => {
      // results rendered — content "hi" should appear at least once
      const cells = screen.queryAllByText("hi");
      expect(cells.length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByTestId("compare-rubric-badge")).toHaveLength(0);
  });

  it("rubric_verdict.overall=warn → warn color class", async () => {
    await render_and_run([
      base_result({ rubric_verdict: { overall: "warn" } }),
    ]);

    await waitFor(() => {
      expect(screen.getAllByTestId("compare-rubric-badge").length).toBeGreaterThanOrEqual(1);
    });
    const badge = screen.getAllByTestId("compare-rubric-badge")[0];
    expect(badge.className).toContain("ps-chip--score-warn");
  });
});

describe("ComparePanel — QC-3 route 배지 per cell", () => {
  it("compare 결과에 route_verdict.passed=true 있으면 ROUTED 배지 렌더", async () => {
    await render_and_run([
      base_result({ route_verdict: { passed: true, actual_mode: "once" } }),
      base_result({ provider_id: "anthropic", model: "claude-3" }),
    ]);

    await waitFor(() => {
      expect(screen.getAllByTestId("compare-route-badge").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByTestId("compare-route-badge")[0].textContent).toContain("ROUTED");
  });

  it("compare 결과에 route_verdict.passed=false → MISROUTE 배지 렌더", async () => {
    await render_and_run([
      base_result({ route_verdict: { passed: false, actual_mode: "agent", codes: ["unnecessary_agent"] } }),
    ]);

    await waitFor(() => {
      expect(screen.getAllByTestId("compare-route-badge").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByTestId("compare-route-badge")[0].textContent).toContain("MISROUTE");
  });

  it("route_verdict 없으면 route 배지 미렌더", async () => {
    await render_and_run([
      base_result(),
      base_result({ provider_id: "anthropic", model: "claude-3" }),
    ]);

    await waitFor(() => {
      const cells = screen.queryAllByText("hi");
      expect(cells.length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByTestId("compare-route-badge")).toHaveLength(0);
  });
});

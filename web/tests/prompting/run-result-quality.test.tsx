/**
 * QC-2 / QC-3: RunResult — rubric_verdict badge + route_verdict badge テスト.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RunResult, type RunResultValue } from "@/pages/prompting/run-result";

function make_value(overrides: Partial<RunResultValue> = {}): RunResultValue {
  return {
    content: "hello",
    finish_reason: "stop",
    latency_ms: 500,
    usage: { total_tokens: 100 },
    model: "claude-3",
    provider_id: "anthropic",
    ...overrides,
  };
}

describe("RunResult — QC-2 rubric_verdict 배지", () => {
  it("rubric_verdict 없으면 rubric 배지 미렌더", () => {
    render(<RunResult value={make_value()} />);
    expect(screen.queryByTestId("rubric-verdict-badge")).toBeNull();
  });

  it("rubric_verdict.overall=pass → PASS 배지 렌더", () => {
    render(
      <RunResult
        value={make_value({
          rubric_verdict: { overall: "pass" },
        })}
      />,
    );
    const badge = screen.getByTestId("rubric-verdict-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("PASS");
  });

  it("rubric_verdict.overall=warn → WARN 배지 렌더", () => {
    render(
      <RunResult
        value={make_value({
          rubric_verdict: { overall: "warn" },
        })}
      />,
    );
    expect(screen.getByTestId("rubric-verdict-badge").textContent).toContain("WARN");
  });

  it("rubric_verdict.overall=fail → FAIL 배지 렌더", () => {
    render(
      <RunResult
        value={make_value({
          rubric_verdict: { overall: "fail" },
        })}
      />,
    );
    expect(screen.getByTestId("rubric-verdict-badge").textContent).toContain("FAIL");
  });

  it("dimensions 있으면 클릭 시 dropdown 토글", () => {
    render(
      <RunResult
        value={make_value({
          rubric_verdict: {
            overall: "warn",
            dimensions: [
              { dimension: "overall", score: 0.65, verdict: "warn" },
            ],
          },
        })}
      />,
    );
    const badge = screen.getByTestId("rubric-verdict-badge");
    expect(screen.queryByTestId("rubric-dimensions")).toBeNull();
    fireEvent.click(badge);
    expect(screen.getByTestId("rubric-dimensions")).toBeInTheDocument();
    // 두 번 클릭 시 닫힘
    fireEvent.click(badge);
    expect(screen.queryByTestId("rubric-dimensions")).toBeNull();
  });

  it("에러 상태에서 rubric_verdict 있어도 에러 뷰 렌더 (배지 없음)", () => {
    render(
      <RunResult
        value={make_value({
          error: "API failed",
          rubric_verdict: { overall: "pass" },
        })}
      />,
    );
    expect(screen.getByText("API failed")).toBeInTheDocument();
    expect(screen.queryByTestId("rubric-verdict-badge")).toBeNull();
  });
});

describe("RunResult — QC-3 route_verdict 배지", () => {
  it("route_verdict 없으면 route 배지 미렌더", () => {
    render(<RunResult value={make_value()} />);
    expect(screen.queryByTestId("route-verdict-badge")).toBeNull();
  });

  it("route_verdict.passed=true, codes 없음 → ROUTED 배지 렌더 (ok color)", () => {
    render(
      <RunResult
        value={make_value({
          route_verdict: { passed: true, actual_mode: "once" },
        })}
      />,
    );
    const badge = screen.getByTestId("route-verdict-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("ROUTED");
    expect(badge.className).toContain("ps-chip--score-ok");
  });

  it("route_verdict.passed=true, codes 있음 → ROUTED 배지 (warn color)", () => {
    render(
      <RunResult
        value={make_value({
          route_verdict: { passed: true, actual_mode: "agent", codes: ["cost_tradeoff"], severity: "minor" },
        })}
      />,
    );
    const badge = screen.getByTestId("route-verdict-badge");
    expect(badge.textContent).toContain("ROUTED");
    expect(badge.className).toContain("ps-chip--score-warn");
  });

  it("route_verdict.passed=false → MISROUTE 배지 렌더 (err color)", () => {
    render(
      <RunResult
        value={make_value({
          route_verdict: { passed: false, actual_mode: "agent", codes: ["unnecessary_agent"], severity: "major" },
        })}
      />,
    );
    const badge = screen.getByTestId("route-verdict-badge");
    expect(badge.textContent).toContain("MISROUTE");
    expect(badge.className).toContain("ps-chip--score-err");
  });

  it("에러 상태에서 route_verdict 있어도 에러 뷰 렌더 (route 배지 없음)", () => {
    render(
      <RunResult
        value={make_value({
          error: "fail",
          route_verdict: { passed: true },
        })}
      />,
    );
    expect(screen.queryByTestId("route-verdict-badge")).toBeNull();
  });
});

/**
 * QC-2: EvalEditPanel — quality gate display (rubric_verdict badge).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
// BuilderField: render label + children
vi.mock("@/pages/workflows/builder-field", () => ({
  BuilderField: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <span data-testid="field-label">{label}</span>
      {children}
    </div>
  ),
}));

import { eval_descriptor } from "@/pages/workflows/nodes/eval";

const EditPanel = eval_descriptor.EditPanel;
const t = (key: string) => key;
const update = vi.fn();

function make_node(overrides: Record<string, unknown> = {}) {
  return { code: "return 1+1;", context: "", ...overrides };
}

describe("EvalEditPanel — QC-2 quality gate 배지", () => {
  it("rubric_verdict 없으면 quality gate 섹션 미렌더", () => {
    render(<EditPanel node={make_node()} update={update} t={t} />);
    expect(screen.queryByTestId("eval-quality-gate")).toBeNull();
  });

  it("rubric_verdict='pass' → PASS 배지 렌더", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "pass" })} update={update} t={t} />);
    const gate = screen.getByTestId("eval-quality-gate");
    expect(gate).toBeInTheDocument();
    expect(gate.textContent).toContain("PASS");
  });

  it("rubric_verdict='warn' → WARN 배지 렌더", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "warn" })} update={update} t={t} />);
    expect(screen.getByTestId("eval-quality-gate").textContent).toContain("WARN");
  });

  it("rubric_verdict='fail' → FAIL 배지 렌더", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "fail" })} update={update} t={t} />);
    expect(screen.getByTestId("eval-quality-gate").textContent).toContain("FAIL");
  });

  it("rubric_verdict='pass', eval_score=0.9 → 90% 점수 포함 렌더", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "pass", eval_score: 0.9 })} update={update} t={t} />);
    const gate = screen.getByTestId("eval-quality-gate");
    expect(gate.textContent).toContain("90%");
  });

  it("quality gate label이 node.eval.quality_gate 키로 렌더됨", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "pass" })} update={update} t={t} />);
    // BuilderField mock renders the label with data-testid="field-label"
    const labels = screen.getAllByTestId("field-label");
    expect(labels.some((l) => l.textContent === "node.eval.quality_gate")).toBe(true);
  });

  it("code textarea는 rubric_verdict 존재와 무관하게 항상 렌더", () => {
    render(<EditPanel node={make_node({ rubric_verdict: "pass" })} update={update} t={t} />);
    // code-textarea should be present
    const areas = document.querySelectorAll(".code-textarea");
    expect(areas.length).toBeGreaterThanOrEqual(1);
  });
});

describe("EvalEditPanel — 출력 스키마 rubric_verdict 포함", () => {
  it("output_schema에 rubric_verdict 항목 존재", () => {
    const schema = eval_descriptor.output_schema ?? [];
    const has_rubric = schema.some((s) => s.name === "rubric_verdict");
    expect(has_rubric).toBe(true);
  });
});

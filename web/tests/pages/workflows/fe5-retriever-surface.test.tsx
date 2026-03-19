/**
 * FE-5: retriever node — retrieval status badge + lexical/semantic mode 표시 검증.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { retriever_descriptor } from "@/pages/workflows/nodes/retriever";

type TFunction = (key: string) => string;

function make_node(overrides: Record<string, unknown> = {}) {
  return { ...retriever_descriptor.create_default(), ...overrides };
}

function render_panel(node: Record<string, unknown>) {
  const EditPanel = retriever_descriptor.EditPanel;
  const update = vi.fn();
  const t: TFunction = (key: string) => key;
  render(<EditPanel node={node} update={update} t={t} />);
  return { update };
}

// -- retrieval 상태 배지 --

describe("RetrieverEditPanel — retrieval status badge (FE-5)", () => {
  it("retrieval_status=ready -> ok badge", () => {
    render_panel(make_node({ retrieval_status: "ready" }));
    const badge = screen.getByTestId("retrieval-status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("ready");
  });

  it("retrieval_status=indexing -> warn badge", () => {
    render_panel(make_node({ retrieval_status: "indexing" }));
    const badge = screen.getByTestId("retrieval-status-badge");
    expect(badge.querySelector(".badge--warn")).toBeInTheDocument();
  });

  it("retrieval_status 없으면 badge 미렌더", () => {
    render_panel(make_node());
    expect(screen.queryByTestId("retrieval-status-badge")).toBeNull();
  });
});

// -- lexical/semantic 모드 표시 --

describe("RetrieverEditPanel — retrieval mode (FE-5)", () => {
  it("기본값 semantic mode badge 렌더", () => {
    render_panel(make_node());
    const badge = screen.getByTestId("retrieval-mode-badge");
    expect(badge.textContent).toBe("semantic");
  });

  it("lexical mode 선택 시 select 값 반영", () => {
    render_panel(make_node({ retrieval_mode: "lexical" }));
    const select = screen.getByTestId("retrieval-mode-select") as HTMLSelectElement;
    expect(select.value).toBe("lexical");
    const badge = screen.getByTestId("retrieval-mode-badge");
    expect(badge.textContent).toBe("lexical");
  });

  it("hybrid mode select + badge", () => {
    render_panel(make_node({ retrieval_mode: "hybrid" }));
    const select = screen.getByTestId("retrieval-mode-select") as HTMLSelectElement;
    expect(select.value).toBe("hybrid");
    const badge = screen.getByTestId("retrieval-mode-badge");
    expect(badge.textContent).toBe("hybrid");
  });

  it("retrieval_mode_* i18n 키 select options에 포함", () => {
    render_panel(make_node());
    expect(screen.getByText("workflows.retrieval_mode_lexical")).toBeInTheDocument();
    expect(screen.getByText("workflows.retrieval_mode_semantic")).toBeInTheDocument();
    expect(screen.getByText("workflows.retrieval_mode_hybrid")).toBeInTheDocument();
  });
});

// -- create_default에 retrieval_mode 포함 --

describe("retriever_descriptor — create_default (FE-5)", () => {
  it("create_default에 retrieval_mode=semantic 포함", () => {
    const defaults = retriever_descriptor.create_default();
    expect(defaults).toHaveProperty("retrieval_mode", "semantic");
  });
});

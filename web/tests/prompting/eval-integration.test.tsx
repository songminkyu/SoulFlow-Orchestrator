/** EV FE: eval 관련 기존 컴포넌트 연결 검증. */
import { describe, it, expect } from "vitest";
import { eval_descriptor } from "@/pages/workflows/nodes/eval";

describe("eval workflow node descriptor", () => {
  it("node_type이 eval", () => {
    expect(eval_descriptor.node_type).toBe("eval");
  });

  it("input/output schema 정의", () => {
    expect(eval_descriptor.input_schema.length).toBeGreaterThan(0);
    expect(eval_descriptor.output_schema.length).toBeGreaterThan(0);
  });

  it("EditPanel이 존재", () => {
    expect(eval_descriptor.EditPanel).toBeDefined();
  });
});

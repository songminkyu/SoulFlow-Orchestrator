/**
 * LF-1: Layer Boundary Codification 검증.
 */

import { describe, it, expect } from "vitest";
import {
  LAYER_ORDER,
  LAYER_OWNERSHIP,
  LAYER_DESCRIPTIONS,
  layer_annotation,
  is_dependency_allowed,
  type LayerId,
} from "@src/bootstrap/layer-boundaries.js";

describe("LAYER_ORDER", () => {
  it("모든 레이어에 순서 값이 정의됨", () => {
    const layers: LayerId[] = ["ingress", "gateway", "execution", "worker", "delivery", "state", "observability"];
    for (const layer of layers) {
      expect(typeof LAYER_ORDER[layer]).toBe("number");
    }
  });

  it("ingress < gateway < execution < worker < delivery < state < observability", () => {
    expect(LAYER_ORDER.ingress).toBeLessThan(LAYER_ORDER.gateway);
    expect(LAYER_ORDER.gateway).toBeLessThan(LAYER_ORDER.execution);
    expect(LAYER_ORDER.execution).toBeLessThan(LAYER_ORDER.worker);
    expect(LAYER_ORDER.worker).toBeLessThan(LAYER_ORDER.delivery);
    expect(LAYER_ORDER.delivery).toBeLessThan(LAYER_ORDER.state);
    expect(LAYER_ORDER.state).toBeLessThan(LAYER_ORDER.observability);
  });
});

describe("LAYER_OWNERSHIP", () => {
  it("모든 레이어에 소유 경로 목록이 정의됨", () => {
    const layers: LayerId[] = ["ingress", "gateway", "execution", "worker", "delivery", "state", "observability"];
    for (const layer of layers) {
      expect(Array.isArray(LAYER_OWNERSHIP[layer])).toBe(true);
      expect(LAYER_OWNERSHIP[layer].length).toBeGreaterThan(0);
    }
  });

  it("worker 레이어는 worker-dispatch를 포함", () => {
    expect(LAYER_OWNERSHIP.worker.some((p) => p.includes("worker-dispatch"))).toBe(true);
  });

  it("delivery 레이어는 broadcaster를 포함", () => {
    expect(LAYER_OWNERSHIP.delivery.some((p) => p.includes("broadcaster"))).toBe(true);
  });
});

describe("LAYER_DESCRIPTIONS", () => {
  it("모든 레이어에 한글 설명이 있음", () => {
    const layers: LayerId[] = ["ingress", "gateway", "execution", "worker", "delivery", "state", "observability"];
    for (const layer of layers) {
      expect(typeof LAYER_DESCRIPTIONS[layer]).toBe("string");
      expect(LAYER_DESCRIPTIONS[layer].length).toBeGreaterThan(0);
    }
  });
});

describe("layer_annotation", () => {
  it("입력 그대로 반환 (identity 함수)", () => {
    const annotation = layer_annotation({
      layer: "worker",
      boundary_note: "test note",
    });
    expect(annotation.layer).toBe("worker");
    expect(annotation.boundary_note).toBe("test note");
  });

  it("allowed_deps 미지정 시 undefined", () => {
    const annotation = layer_annotation({ layer: "execution" });
    expect(annotation.allowed_deps).toBeUndefined();
  });

  it("allowed_deps 지정 시 보존", () => {
    const annotation = layer_annotation({
      layer: "gateway",
      allowed_deps: ["state", "observability"],
    });
    expect(annotation.allowed_deps).toEqual(["state", "observability"]);
  });
});

describe("is_dependency_allowed", () => {
  it("observability → 어느 레이어도 허용", () => {
    const layers: LayerId[] = ["ingress", "gateway", "execution", "worker", "delivery", "state"];
    for (const target of layers) {
      expect(is_dependency_allowed("observability", target)).toBe(true);
    }
  });

  it("상위 레이어가 하위 레이어를 참조하는 것은 허용", () => {
    // state(5) → ingress(0) 참조 → OK (숫자 높은 쪽이 낮은 쪽 참조)
    expect(is_dependency_allowed("state", "ingress")).toBe(true);
    // worker(3) → execution(2) 참조 → OK
    expect(is_dependency_allowed("worker", "execution")).toBe(true);
    // observability(6) → delivery(4) 참조 → OK
    expect(is_dependency_allowed("observability", "delivery")).toBe(true);
    // state(5) → gateway(1) 참조 → OK
    expect(is_dependency_allowed("state", "gateway")).toBe(true);
  });

  it("하위 레이어가 상위 레이어를 역참조하는 것은 금지", () => {
    // ingress(0) → worker(3) 역방향 금지
    expect(is_dependency_allowed("ingress", "worker")).toBe(false);
    // execution(2) → delivery(4) 역방향 금지
    expect(is_dependency_allowed("execution", "delivery")).toBe(false);
    // gateway(1) → state(5) 역방향 금지
    expect(is_dependency_allowed("gateway", "state")).toBe(false);
  });

  it("같은 레이어 참조는 허용 (수평 협력)", () => {
    const layers: LayerId[] = ["ingress", "gateway", "execution", "worker", "delivery", "state"];
    for (const layer of layers) {
      expect(is_dependency_allowed(layer, layer)).toBe(true);
    }
  });
});

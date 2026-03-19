/**
 * LF-5: Local Ops Defaults — 설정 기본값 회귀 검증.
 */

import { describe, it, expect } from "vitest";
import {
  LOCAL_OPS_DEFAULTS,
  merge_local_defaults,
  type LocalOpsDefaults,
} from "@src/config/local-defaults.js";

/* ── LOCAL_OPS_DEFAULTS 상수 검증 ── */

describe("LOCAL_OPS_DEFAULTS", () => {
  it("bind.host가 0.0.0.0 (모든 인터페이스 바인딩)", () => {
    expect(LOCAL_OPS_DEFAULTS.bind.host).toBe("0.0.0.0");
  });

  it("bind.port가 4200", () => {
    expect(LOCAL_OPS_DEFAULTS.bind.port).toBe(4200);
  });

  it("bind.port_fallback이 false (로컬에서 포트 충돌 시 실패 명시)", () => {
    expect(LOCAL_OPS_DEFAULTS.bind.port_fallback).toBe(false);
  });

  it("gpu.enabled가 true (로컬 GPU 기본 활성화)", () => {
    expect(LOCAL_OPS_DEFAULTS.gpu.enabled).toBe(true);
  });

  it("gpu.args가 빈 배열 (기본 GPU 인수 없음)", () => {
    expect(Array.isArray(LOCAL_OPS_DEFAULTS.gpu.args)).toBe(true);
    expect(LOCAL_OPS_DEFAULTS.gpu.args.length).toBe(0);
  });

  it("redis.url이 로컬 컨테이너 주소", () => {
    expect(LOCAL_OPS_DEFAULTS.redis.url).toBe("redis://redis:6379");
  });

  it("redis.key_prefix가 sf:bus:", () => {
    expect(LOCAL_OPS_DEFAULTS.redis.key_prefix).toBe("sf:bus:");
  });

  it("worker.inbound_concurrency가 4", () => {
    expect(LOCAL_OPS_DEFAULTS.worker.inbound_concurrency).toBe(4);
  });

  it("worker.queue_saturation_threshold가 0.8", () => {
    expect(LOCAL_OPS_DEFAULTS.worker.queue_saturation_threshold).toBe(0.8);
  });

  it("worker.local_queue_only가 false (remote_queue 허용)", () => {
    expect(LOCAL_OPS_DEFAULTS.worker.local_queue_only).toBe(false);
  });

  it("LocalOpsDefaults 타입과 호환", () => {
    const defaults: LocalOpsDefaults = LOCAL_OPS_DEFAULTS;
    expect(defaults).toBeDefined();
  });
});

/* ── merge_local_defaults ── */

describe("merge_local_defaults", () => {
  it("빈 오버라이드 → 모두 기본값", () => {
    const result = merge_local_defaults({});
    expect(result.dashboard.port).toBe(LOCAL_OPS_DEFAULTS.bind.port);
    expect(result.dashboard.host).toBe(LOCAL_OPS_DEFAULTS.bind.host);
    expect(result.dashboard.portFallback).toBe(LOCAL_OPS_DEFAULTS.bind.port_fallback);
    expect(result.orchestratorLlm.gpuEnabled).toBe(LOCAL_OPS_DEFAULTS.gpu.enabled);
    expect(result.orchestratorLlm.gpuArgs).toEqual([...LOCAL_OPS_DEFAULTS.gpu.args]);
    expect(result.bus.redis.url).toBe(LOCAL_OPS_DEFAULTS.redis.url);
    expect(result.bus.redis.keyPrefix).toBe(LOCAL_OPS_DEFAULTS.redis.key_prefix);
    expect(result.channel.inboundConcurrency).toBe(LOCAL_OPS_DEFAULTS.worker.inbound_concurrency);
  });

  it("dashboard.port 오버라이드 → 해당 값 사용", () => {
    const result = merge_local_defaults({ dashboard: { port: 8080 } });
    expect(result.dashboard.port).toBe(8080);
    expect(result.dashboard.host).toBe(LOCAL_OPS_DEFAULTS.bind.host);
  });

  it("dashboard.host 오버라이드 → 해당 값 사용", () => {
    const result = merge_local_defaults({ dashboard: { host: "127.0.0.1" } });
    expect(result.dashboard.host).toBe("127.0.0.1");
    expect(result.dashboard.port).toBe(LOCAL_OPS_DEFAULTS.bind.port);
  });

  it("orchestratorLlm.gpuEnabled=false 오버라이드", () => {
    const result = merge_local_defaults({ orchestratorLlm: { gpuEnabled: false } });
    expect(result.orchestratorLlm.gpuEnabled).toBe(false);
  });

  it("orchestratorLlm.gpuArgs 오버라이드", () => {
    const result = merge_local_defaults({ orchestratorLlm: { gpuArgs: ["--gpus", "all"] } });
    expect(result.orchestratorLlm.gpuArgs).toEqual(["--gpus", "all"]);
  });

  it("bus.redis.url 오버라이드", () => {
    const result = merge_local_defaults({ bus: { redis: { url: "redis://prod:6379" } } });
    expect(result.bus.redis.url).toBe("redis://prod:6379");
    expect(result.bus.redis.keyPrefix).toBe(LOCAL_OPS_DEFAULTS.redis.key_prefix);
  });

  it("channel.inboundConcurrency 오버라이드", () => {
    const result = merge_local_defaults({ channel: { inboundConcurrency: 8 } });
    expect(result.channel.inboundConcurrency).toBe(8);
  });

  it("반환값은 오버라이드 없이도 완전한 객체", () => {
    const result = merge_local_defaults({});
    expect(result.dashboard).toBeDefined();
    expect(result.orchestratorLlm).toBeDefined();
    expect(result.bus.redis).toBeDefined();
    expect(result.channel).toBeDefined();
  });

  it("gpuArgs는 새 배열 반환 (원본 불변)", () => {
    const result = merge_local_defaults({});
    result.orchestratorLlm.gpuArgs.push("--extra");
    // 다시 병합해도 기본값 유지
    const result2 = merge_local_defaults({});
    expect(result2.orchestratorLlm.gpuArgs).toEqual([]);
  });
});

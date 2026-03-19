/**
 * LF-2: WorkerDispatch suitability 및 dispatch 로직 검증.
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolve_dispatch_mode,
  WorkerDispatch,
  type WorkerSuitabilityInput,
  type WorkerJobDescriptor,
  type WorkerDispatchMode,
} from "@src/orchestration/worker-dispatch.js";

/* ── resolve_dispatch_mode fixtures ── */

function make_input(overrides: Partial<WorkerSuitabilityInput> = {}): WorkerSuitabilityInput {
  return {
    kind: "generation_task",
    redis_available: false,
    requires_durability: false,
    local_queue_load: 0.0,
    ...overrides,
  };
}

describe("resolve_dispatch_mode — suitability 규칙", () => {
  it("내구성 요구 + Redis 사용 가능 → remote_queue", () => {
    const input = make_input({ requires_durability: true, redis_available: true });
    const result = resolve_dispatch_mode(input);
    expect(result.mode).toBe("remote_queue");
    expect(result.reason).toContain("remote_queue");
  });

  it("내구성 불필요 + 부하 낮음 → local_queue", () => {
    const input = make_input({ requires_durability: false, local_queue_load: 0.3 });
    const result = resolve_dispatch_mode(input);
    expect(result.mode).toBe("local_queue");
    expect(result.reason).toContain("local_queue");
  });

  it("내구성 불필요 + 부하 임계치 직전(0.79) → local_queue", () => {
    const input = make_input({ requires_durability: false, local_queue_load: 0.79 });
    const result = resolve_dispatch_mode(input);
    expect(result.mode).toBe("local_queue");
  });

  it("내구성 불필요 + 부하 포화(0.8) → inline", () => {
    const input = make_input({ requires_durability: false, local_queue_load: 0.8 });
    const result = resolve_dispatch_mode(input);
    expect(result.mode).toBe("inline");
  });

  it("내구성 요구 + Redis 없음 → inline (best-effort fallback)", () => {
    const input = make_input({ requires_durability: true, redis_available: false });
    const result = resolve_dispatch_mode(input);
    expect(result.mode).toBe("inline");
    expect(result.reason).toContain("best-effort");
  });

  it("이유(reason) 문자열에 모드가 포함됨", () => {
    const modes: WorkerDispatchMode[] = ["inline", "local_queue", "remote_queue"];
    const inputs: WorkerSuitabilityInput[] = [
      make_input({ requires_durability: false, local_queue_load: 0.9 }), // inline
      make_input({ requires_durability: false, local_queue_load: 0.1 }), // local_queue
      make_input({ requires_durability: true, redis_available: true }),   // remote_queue
    ];
    for (let i = 0; i < modes.length; i++) {
      const result = resolve_dispatch_mode(inputs[i]);
      expect(result.mode).toBe(modes[i]);
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

/* ── WorkerDispatch ── */

function make_job(id: string, run: () => Promise<void> = async () => {}): WorkerJobDescriptor {
  return { job_id: id, kind: "generation_task", run };
}

describe("WorkerDispatch — dispatch 경계", () => {
  it("inline 모드: dispatch 즉시 job.run() 호출", async () => {
    const dispatch = new WorkerDispatch();
    const run = vi.fn(async () => {});
    const job = make_job("j1", run);
    const input = make_input({ requires_durability: false, local_queue_load: 0.9 });

    await dispatch.dispatch(job, input);

    expect(run).toHaveBeenCalledOnce();
  });

  it("local_queue 모드: dispatch 즉시 실행 안 됨, drain 후 실행", async () => {
    const dispatch = new WorkerDispatch();
    const run = vi.fn(async () => {});
    const job = make_job("j2", run);
    const input = make_input({ requires_durability: false, local_queue_load: 0.1 });

    await dispatch.dispatch(job, input);
    expect(run).not.toHaveBeenCalled();

    await dispatch.drain_local_queue();
    expect(run).toHaveBeenCalledOnce();
  });

  it("remote_queue 모드 + remote_dispatch 주입: remote_dispatch 호출", async () => {
    const remote_dispatch = vi.fn(async () => {});
    const dispatch = new WorkerDispatch({ remote_dispatch });
    const job = make_job("j3");
    const input = make_input({ requires_durability: true, redis_available: true });

    await dispatch.dispatch(job, input);

    expect(remote_dispatch).toHaveBeenCalledWith(job);
  });

  it("remote_queue 모드 + remote_dispatch 미주입: local_queue로 폴백", async () => {
    const dispatch = new WorkerDispatch();
    const run = vi.fn(async () => {});
    const job = make_job("j4", run);
    const input = make_input({ requires_durability: true, redis_available: true });

    const decision = await dispatch.dispatch(job, input);

    expect(decision.mode).toBe("remote_queue");
    expect(run).not.toHaveBeenCalled(); // local_queue에 추가됨

    await dispatch.drain_local_queue();
    expect(run).toHaveBeenCalledOnce();
  });

  it("get_status — pending_local 및 mode_distribution 반영", async () => {
    const dispatch = new WorkerDispatch();

    // local_queue에 2개 추가
    await dispatch.dispatch(make_job("j5"), make_input({ local_queue_load: 0.1 }));
    await dispatch.dispatch(make_job("j6"), make_input({ local_queue_load: 0.1 }));
    // inline 1개
    await dispatch.dispatch(make_job("j7"), make_input({ local_queue_load: 0.9 }));

    const status = dispatch.get_status();
    expect(status.pending_local).toBe(2);
    expect(status.mode_distribution.local_queue).toBe(2);
    expect(status.mode_distribution.inline).toBe(1);
    expect(status.mode_distribution.remote_queue).toBe(0);
  });

  it("drain_local_queue — 큐를 순차적으로 모두 처리", async () => {
    const dispatch = new WorkerDispatch();
    const order: number[] = [];

    for (let i = 0; i < 3; i++) {
      const idx = i;
      await dispatch.dispatch(
        { job_id: `seq-${idx}`, kind: "cron", run: async () => { order.push(idx); } },
        make_input({ local_queue_load: 0.1 }),
      );
    }

    await dispatch.drain_local_queue();

    expect(order).toEqual([0, 1, 2]);
    expect(dispatch.get_status().pending_local).toBe(0);
  });

  it("dispatch 반환값은 WorkerDispatchDecision", async () => {
    const dispatch = new WorkerDispatch();
    const result = await dispatch.dispatch(
      make_job("j8"),
      make_input({ requires_durability: false, local_queue_load: 0.5 }),
    );
    expect(result.mode).toBeDefined();
    expect(typeof result.reason).toBe("string");
  });
});

/**
 * filesystem_watch_handler — 전체 커버리지:
 * - create_default: 기본값 반환
 * - execute: 빈 output 반환
 * - runner_execute: wait 없음, watch_path 없음, injected event, wait 성공, wait null, wait 에러
 * - test: watch_path/events 경고
 */
import { describe, it, expect, vi } from "vitest";
import { filesystem_watch_handler } from "@src/agent/nodes/filesystem-watch.js";

function make_node(overrides: Record<string, unknown> = {}) {
  return {
    node_id: "n1",
    node_type: "filesystem_watch",
    watch_path: "/workspace/watched",
    watch_events: ["add", "change"],
    watch_pattern: "",
    watch_batch_ms: 500,
    ...overrides,
  } as any;
}

function make_runner(wait?: ((path: string, opts: object) => Promise<Record<string, unknown> | null>) | null, workspace?: string) {
  return {
    services: wait !== undefined ? { wait_filesystem_event: wait } : {},
    state: {
      memory: {},
    },
    options: {
      workspace: workspace ?? "/workspace",
    },
    logger: {
      warn: vi.fn(),
      info: vi.fn(),
    },
  } as any;
}

// ══════════════════════════════════════════════════════════
// create_default + execute
// ══════════════════════════════════════════════════════════

describe("filesystem_watch_handler — create_default / execute", () => {
  it("create_default → 기본값 반환", () => {
    const def = filesystem_watch_handler.create_default!();
    expect((def as any).watch_path).toBe("");
    expect((def as any).watch_events).toEqual(["add"]);
    expect((def as any).watch_batch_ms).toBe(500);
  });

  it("execute → 빈 output 반환", async () => {
    const result = await filesystem_watch_handler.execute(make_node(), {} as any);
    expect(result.output.files).toEqual([]);
    expect(result.output.batch_id).toBe("");
  });
});

// ══════════════════════════════════════════════════════════
// runner_execute
// ══════════════════════════════════════════════════════════

describe("filesystem_watch_handler — runner_execute", () => {
  it("wait_filesystem_event 없음 → execute() 결과 반환", async () => {
    const runner = make_runner(null);
    const result = await filesystem_watch_handler.runner_execute!(make_node(), {} as any, {
      ...runner,
      services: undefined, // services 자체 없음
    });
    expect(result.output.files).toEqual([]);
  });

  it("watch_path 없음 → error 반환", async () => {
    const runner = make_runner(vi.fn());
    const result = await filesystem_watch_handler.runner_execute!(
      make_node({ watch_path: "" }),
      {} as any,
      runner,
    );
    expect(result.output.error).toContain("watch_path is required");
  });

  it("injected event 있음 → 즉시 반환 + memory 정리", async () => {
    const injected = { files: [{ path: "/workspace/watched/file.txt", event: "add" }], batch_id: "abc" };
    const runner = make_runner(vi.fn());
    runner.state.memory.__pending_filesystem_watch = true;
    runner.state.memory.__pending_filesystem_watch_event = injected;

    const result = await filesystem_watch_handler.runner_execute!(make_node(), {} as any, runner);
    expect(result.output).toEqual(injected);
    expect(runner.state.memory.__pending_filesystem_watch_event).toBeUndefined();
  });

  it("wait 성공 → event 반환", async () => {
    const event = { files: [{ path: "/workspace/watched/new.txt", event: "add" }], batch_id: "xyz", triggered_at: new Date().toISOString(), watch_path: "/workspace/watched" };
    const runner = make_runner(vi.fn().mockResolvedValue(event));

    const result = await filesystem_watch_handler.runner_execute!(make_node(), {} as any, runner);
    expect(result.output).toEqual(event);
  });

  it("wait → null 반환 → waiting=true", async () => {
    const runner = make_runner(vi.fn().mockResolvedValue(null));

    const result = await filesystem_watch_handler.runner_execute!(make_node(), {} as any, runner);
    expect(result.output.waiting).toBe(true);
    expect(result.output.files).toEqual([]);
  });

  it("wait → 에러 throw → error 반환", async () => {
    const runner = make_runner(vi.fn().mockRejectedValue(new Error("ENOENT: path not found")));

    const result = await filesystem_watch_handler.runner_execute!(make_node(), {} as any, runner);
    expect(result.output.error).toContain("ENOENT");
    expect(runner.logger.warn).toHaveBeenCalled();
  });

  it("watch_events 없음 → 기본 ['add'] 사용", async () => {
    const wait_fn = vi.fn().mockResolvedValue({ files: [], batch_id: "b1", triggered_at: "", watch_path: "/workspace/x" });
    const runner = make_runner(wait_fn);

    await filesystem_watch_handler.runner_execute!(make_node({ watch_events: [] }), {} as any, runner);
    const call_opts = wait_fn.mock.calls[0][1] as any;
    expect(call_opts.events).toEqual(["add"]);
  });

  it("watch_pattern 있음 → pattern 전달", async () => {
    const wait_fn = vi.fn().mockResolvedValue({ files: [], batch_id: "b2", triggered_at: "", watch_path: "/workspace/x" });
    const runner = make_runner(wait_fn);

    await filesystem_watch_handler.runner_execute!(
      make_node({ watch_pattern: "*.ts" }),
      {} as any,
      runner,
    );
    const call_opts = wait_fn.mock.calls[0][1] as any;
    expect(call_opts.pattern).toBe("*.ts");
  });

  // ── CWE-22: 경로 검증 ────────────────────────────────
  it("workspace 밖 watch_path → error 반환 (CWE-22)", async () => {
    const wait_fn = vi.fn();
    const runner = make_runner(wait_fn, "/workspace");

    const result = await filesystem_watch_handler.runner_execute!(
      make_node({ watch_path: "/etc/secrets" }),
      {} as any,
      runner,
    );
    expect(result.output.error).toBe("watch_path outside workspace");
    expect(wait_fn).not.toHaveBeenCalled();
  });

  it("path traversal 시도 → error 반환 (CWE-22)", async () => {
    const wait_fn = vi.fn();
    const runner = make_runner(wait_fn, "/workspace");

    const result = await filesystem_watch_handler.runner_execute!(
      make_node({ watch_path: "/workspace/../etc/passwd" }),
      {} as any,
      runner,
    );
    expect(result.output.error).toBe("watch_path outside workspace");
    expect(wait_fn).not.toHaveBeenCalled();
  });

  it("workspace 내 watch_path → 정상 동작", async () => {
    const event = { files: [], batch_id: "ok", triggered_at: "", watch_path: "/workspace/data" };
    const wait_fn = vi.fn().mockResolvedValue(event);
    const runner = make_runner(wait_fn, "/workspace");

    const result = await filesystem_watch_handler.runner_execute!(
      make_node({ watch_path: "/workspace/data" }),
      {} as any,
      runner,
    );
    expect(result.output).toEqual(event);
    expect(wait_fn).toHaveBeenCalled();
  });

  it("workspace 미설정 시 → 경로 검증 스킵 (하위 호환)", async () => {
    const event = { files: [], batch_id: "compat", triggered_at: "", watch_path: "/anywhere" };
    const wait_fn = vi.fn().mockResolvedValue(event);
    const runner = make_runner(wait_fn);
    runner.options.workspace = "";

    const result = await filesystem_watch_handler.runner_execute!(
      make_node({ watch_path: "/anywhere" }),
      {} as any,
      runner,
    );
    expect(result.output).toEqual(event);
  });
});

// ══════════════════════════════════════════════════════════
// test
// ══════════════════════════════════════════════════════════

describe("filesystem_watch_handler — test", () => {
  it("watch_path 있고 events 있음 → warnings 없음", () => {
    const result = filesystem_watch_handler.test!(make_node(), {} as any);
    expect(result.warnings).toHaveLength(0);
  });

  it("watch_path 없음 → warning 포함", () => {
    const result = filesystem_watch_handler.test!(make_node({ watch_path: "" }), {} as any);
    expect(result.warnings?.some((w: string) => w.includes("watch_path"))).toBe(true);
  });

  it("watch_events 없음 → warning 포함", () => {
    const result = filesystem_watch_handler.test!(make_node({ watch_events: [] }), {} as any);
    expect(result.warnings?.some((w: string) => w.includes("watch_events"))).toBe(true);
  });
});

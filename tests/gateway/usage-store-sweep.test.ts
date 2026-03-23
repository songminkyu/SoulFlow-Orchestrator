/**
 * UsageStore.sweep() — 오래된 llm_spans row 자동 정리 테스트.
 * - 90일 이전 row 삽입 후 sweep() 호출 시 삭제 확인
 * - 최근 row는 보존 확인
 * - 반환값이 삭제 수와 일치 확인
 * - close() 호출 시 타이머 해제 확인
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UsageStore } from "@src/gateway/usage-store.js";

async function make_tmpdir(prefix = "usage-sweep-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/** 지정 일수만큼 과거 ISO 문자열 생성. */
function days_ago(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function make_span(provider_id: string, at: string) {
  return {
    provider_id,
    model: "gpt-4",
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 150,
    cost_usd: 0.01,
    latency_ms: 200,
    finish_reason: "stop",
    chat_id: null,
    at,
  };
}

describe("UsageStore.sweep()", () => {
  let dir: string;
  let store: UsageStore;

  afterEach(async () => {
    store?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("90일 이전 row를 삭제하고 최근 row는 보존", async () => {
    dir = await make_tmpdir();
    store = new UsageStore(dir);

    // init 완료 대기
    await store.list_spans({ limit: 1 });

    // 과거 row 3개 삽입 (100일, 95일, 91일 전)
    store.record(make_span("openai", days_ago(100)));
    store.record(make_span("openai", days_ago(95)));
    store.record(make_span("anthropic", days_ago(91)));

    // 최근 row 2개 삽입 (10일, 1일 전)
    store.record(make_span("openai", days_ago(10)));
    store.record(make_span("anthropic", days_ago(1)));

    // write queue 소진 대기
    await new Promise((r) => setTimeout(r, 200));

    // sweep 전 확인
    const before = await store.list_spans({ limit: 100 });
    expect(before.length).toBe(5);

    // sweep 실행
    const deleted = store.sweep(90);
    expect(deleted).toBe(3);

    // sweep 후 확인 — 최근 2개만 남음
    const after = await store.list_spans({ limit: 100 });
    expect(after.length).toBe(2);

    // 남은 row가 모두 최근 것인지 확인
    const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
    for (const span of after) {
      expect(span.at >= cutoff).toBe(true);
    }
  });

  it("삭제할 row가 없으면 0 반환", async () => {
    dir = await make_tmpdir();
    store = new UsageStore(dir);
    await store.list_spans({ limit: 1 });

    // 최근 row만 삽입
    store.record(make_span("openai", days_ago(1)));
    await new Promise((r) => setTimeout(r, 100));

    const deleted = store.sweep(90);
    expect(deleted).toBe(0);

    const rows = await store.list_spans({ limit: 100 });
    expect(rows.length).toBe(1);
  });

  it("custom retention_days 파라미터 동작", async () => {
    dir = await make_tmpdir();
    store = new UsageStore(dir);
    await store.list_spans({ limit: 1 });

    // 15일 전, 5일 전 row
    store.record(make_span("openai", days_ago(15)));
    store.record(make_span("openai", days_ago(5)));
    await new Promise((r) => setTimeout(r, 100));

    // 7일 retention — 15일 전 row만 삭제
    const deleted = store.sweep(7);
    expect(deleted).toBe(1);

    const rows = await store.list_spans({ limit: 100 });
    expect(rows.length).toBe(1);
  });

  it("close()로 sweep 타이머 해제", async () => {
    dir = await make_tmpdir();
    store = new UsageStore(dir);
    await store.list_spans({ limit: 1 });

    // close 호출 — 에러 없이 완료
    store.close();
    // 이중 close도 안전
    store.close();
  });
});

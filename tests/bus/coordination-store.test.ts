/**
 * PA-5: CoordinationStore 포트 준수(conformance) + TTL + owner + sweep 테스트.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LocalCoordinationStore,
  create_local_coordination_store,
  type CoordinationStoreLike,
} from "@src/bus/coordination-store.js";

/* ─── Port conformance ─── */
describe("CoordinationStoreLike conformance", () => {
  it("create_local_coordination_store → CoordinationStoreLike 인터페이스 충족", () => {
    const store = create_local_coordination_store();
    expect(typeof store.acquire).toBe("function");
    expect(typeof store.release).toBe("function");
    expect(typeof store.get).toBe("function");
    expect(typeof store.list).toBe("function");
    expect(typeof store.sweep).toBe("function");
  });
});

/* ─── acquire 기본 동작 ─── */
describe("LocalCoordinationStore — acquire", () => {
  let store: CoordinationStoreLike;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("락 획득 성공 → CoordinationEntry 반환", async () => {
    store = new LocalCoordinationStore();
    const entry = await store.acquire("lock:A", "agent-1", 5_000);
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("lock:A");
    expect(entry!.owner).toBe("agent-1");
    expect(entry!.expires_at).toBeGreaterThan(Date.now());
    expect(entry!.acquired_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("타인 소유 락 → null 반환", async () => {
    store = new LocalCoordinationStore();
    await store.acquire("lock:B", "agent-1", 5_000);
    const result = await store.acquire("lock:B", "agent-2", 5_000);
    expect(result).toBeNull();
  });

  it("동일 owner 재획득 → TTL 갱신 후 entry 반환", async () => {
    store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("lock:C", "agent-1", 3_000);
    // 2초 후 TTL 갱신
    vi.advanceTimersByTime(2_000);
    const renewed = await store.acquire("lock:C", "agent-1", 3_000);
    expect(renewed).not.toBeNull();
    expect(renewed!.expires_at).toBe(1_002_000 + 3_000); // 1_002_000 + ttl

    vi.useRealTimers();
  });

  it("만료된 락 → 새 owner 획득 가능", async () => {
    store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("lock:D", "agent-1", 1_000);
    vi.advanceTimersByTime(2_000); // 만료

    const result = await store.acquire("lock:D", "agent-2", 5_000);
    expect(result).not.toBeNull();
    expect(result!.owner).toBe("agent-2");

    vi.useRealTimers();
  });
});

/* ─── release 동작 ─── */
describe("LocalCoordinationStore — release", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("정상 release → true + get null", async () => {
    const store = new LocalCoordinationStore();
    await store.acquire("lock:R1", "owner-1", 5_000);
    const ok = await store.release("lock:R1", "owner-1");
    expect(ok).toBe(true);
    const entry = await store.get("lock:R1");
    expect(entry).toBeNull();
  });

  it("소유자 불일치 release → false", async () => {
    const store = new LocalCoordinationStore();
    await store.acquire("lock:R2", "owner-1", 5_000);
    const ok = await store.release("lock:R2", "wrong-owner");
    expect(ok).toBe(false);
    // 락은 여전히 유효
    const entry = await store.get("lock:R2");
    expect(entry).not.toBeNull();
  });

  it("없는 키 release → false", async () => {
    const store = new LocalCoordinationStore();
    const ok = await store.release("nonexistent", "owner");
    expect(ok).toBe(false);
  });

  it("만료된 락 release → false", async () => {
    const store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("lock:R3", "owner-1", 500);
    vi.advanceTimersByTime(1_000); // 만료

    const ok = await store.release("lock:R3", "owner-1");
    expect(ok).toBe(false);

    vi.useRealTimers();
  });
});

/* ─── get / TTL ─── */
describe("LocalCoordinationStore — get + TTL", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("유효 항목 조회 → entry 반환", async () => {
    const store = new LocalCoordinationStore();
    await store.acquire("lock:G1", "a1", 5_000);
    const entry = await store.get("lock:G1");
    expect(entry).not.toBeNull();
    expect(entry!.owner).toBe("a1");
  });

  it("만료 항목 조회 → null 반환", async () => {
    const store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("lock:G2", "a1", 1_000);
    vi.advanceTimersByTime(2_000);

    const entry = await store.get("lock:G2");
    expect(entry).toBeNull();

    vi.useRealTimers();
  });

  it("없는 키 조회 → null 반환", async () => {
    const store = new LocalCoordinationStore();
    const entry = await store.get("nope");
    expect(entry).toBeNull();
  });
});

/* ─── list ─── */
describe("LocalCoordinationStore — list", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("유효 항목만 반환", async () => {
    const store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("wf:run1", "a1", 5_000);
    await store.acquire("wf:run2", "a2", 5_000);
    await store.acquire("wf:run3", "a3", 500); // 곧 만료

    vi.advanceTimersByTime(1_000); // run3 만료

    const items = await store.list();
    expect(items).toHaveLength(2);
    expect(items.map(e => e.key).sort()).toEqual(["wf:run1", "wf:run2"]);

    vi.useRealTimers();
  });

  it("prefix 필터", async () => {
    const store = new LocalCoordinationStore();
    await store.acquire("wf:run1", "a1", 5_000);
    await store.acquire("cron:job1", "a2", 5_000);

    const wf_items = await store.list("wf:");
    expect(wf_items).toHaveLength(1);
    expect(wf_items[0].key).toBe("wf:run1");
  });

  it("빈 스토어 → 빈 배열", async () => {
    const store = new LocalCoordinationStore();
    const items = await store.list();
    expect(items).toEqual([]);
  });
});

/* ─── sweep ─── */
describe("LocalCoordinationStore — sweep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("만료 항목 정리 → 제거 수 반환", async () => {
    const store = new LocalCoordinationStore();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    await store.acquire("k1", "a1", 500);
    await store.acquire("k2", "a2", 500);
    await store.acquire("k3", "a3", 5_000);

    vi.advanceTimersByTime(1_000); // k1, k2 만료

    const removed = await store.sweep();
    expect(removed).toBe(2);

    const remaining = await store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].key).toBe("k3");

    vi.useRealTimers();
  });

  it("만료 항목 없음 → 0 반환", async () => {
    const store = new LocalCoordinationStore();
    await store.acquire("k1", "a1", 5_000);

    const removed = await store.sweep();
    expect(removed).toBe(0);
  });

  it("빈 스토어 sweep → 0 반환", async () => {
    const store = new LocalCoordinationStore();
    const removed = await store.sweep();
    expect(removed).toBe(0);
  });
});

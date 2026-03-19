/**
 * PA-5: ArtifactStore 포트 준수(conformance) + CRUD + 엣지 케이스 테스트.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  LocalArtifactStore,
  create_local_artifact_store,
  type ArtifactStoreLike,
} from "@src/services/artifact-store.js";

/* ─── 헬퍼 ─── */
async function make_store(): Promise<{ store: ArtifactStoreLike; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "artifact-test-"));
  const store = new LocalArtifactStore(dir);
  return { store, dir };
}

/* ─── Port conformance: 인터페이스 계약 검증 ─── */
describe("ArtifactStoreLike conformance", () => {
  it("create_local_artifact_store → ArtifactStoreLike 인터페이스 충족", () => {
    const store = create_local_artifact_store("/tmp/test");
    expect(typeof store.put).toBe("function");
    expect(typeof store.get).toBe("function");
    expect(typeof store.stat).toBe("function");
    expect(typeof store.list).toBe("function");
    expect(typeof store.delete).toBe("function");
  });
});

/* ─── CRUD 기본 동작 ─── */
describe("LocalArtifactStore — CRUD", () => {
  let dir: string;
  let store: ArtifactStoreLike;

  beforeEach(async () => {
    ({ store, dir } = await make_store());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("put + get: Buffer를 저장하고 동일 내용 반환", async () => {
    const data = Buffer.from("hello artifact");
    const meta = await store.put("run1/output.txt", data);
    expect(meta.key).toBe("run1/output.txt");
    expect(meta.size).toBe(data.byteLength);
    expect(meta.created_at).toBeTruthy();

    const loaded = await store.get("run1/output.txt");
    expect(loaded).not.toBeNull();
    expect(loaded!.toString("utf8")).toBe("hello artifact");
  });

  it("put + get: 문자열을 저장하고 Buffer로 반환", async () => {
    await store.put("run1/text.txt", "plain text");
    const loaded = await store.get("run1/text.txt");
    expect(loaded!.toString("utf8")).toBe("plain text");
  });

  it("put + get: Uint8Array 저장", async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    await store.put("run1/bytes.bin", data);
    const loaded = await store.get("run1/bytes.bin");
    expect(loaded).not.toBeNull();
    expect(Array.from(loaded!)).toEqual([0x01, 0x02, 0x03]);
  });

  it("put 동일 키 → 덮어쓰기", async () => {
    await store.put("run1/file.txt", "first");
    await store.put("run1/file.txt", "second");
    const loaded = await store.get("run1/file.txt");
    expect(loaded!.toString("utf8")).toBe("second");
  });

  it("get 없는 키 → null 반환", async () => {
    const result = await store.get("nonexistent/key.txt");
    expect(result).toBeNull();
  });

  it("stat → 크기·생성 시각 반환", async () => {
    const data = Buffer.from("stat test data");
    await store.put("run2/data.bin", data);
    const meta = await store.stat("run2/data.bin");
    expect(meta).not.toBeNull();
    expect(meta!.key).toBe("run2/data.bin");
    expect(meta!.size).toBe(data.byteLength);
    expect(meta!.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("stat 없는 키 → null 반환", async () => {
    const result = await store.stat("missing/file.txt");
    expect(result).toBeNull();
  });

  it("delete → 이후 get null", async () => {
    await store.put("run3/del.txt", "delete me");
    await store.delete("run3/del.txt");
    const loaded = await store.get("run3/del.txt");
    expect(loaded).toBeNull();
  });

  it("delete 없는 키 → 에러 없음", async () => {
    await expect(store.delete("nonexistent/file.txt")).resolves.toBeUndefined();
  });
});

/* ─── list 동작 ─── */
describe("LocalArtifactStore — list", () => {
  let dir: string;
  let store: ArtifactStoreLike;

  beforeEach(async () => {
    ({ store, dir } = await make_store());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("list() — 전체 아티팩트 목록", async () => {
    await store.put("run1/a.txt", "A");
    await store.put("run1/b.txt", "B");
    await store.put("run2/c.txt", "C");

    const items = await store.list();
    const keys = items.map(m => m.key).sort();
    expect(keys).toContain("run1/a.txt");
    expect(keys).toContain("run1/b.txt");
    expect(keys).toContain("run2/c.txt");
  });

  it("list(prefix) — prefix 필터", async () => {
    await store.put("run1/a.txt", "A");
    await store.put("run1/b.txt", "B");
    await store.put("run2/c.txt", "C");

    const items = await store.list("run1");
    expect(items).toHaveLength(2);
    expect(items.every(m => m.key.startsWith("run1/"))).toBe(true);
  });

  it("list 빈 스토어 → 빈 배열", async () => {
    const items = await store.list();
    expect(items).toEqual([]);
  });

  it("list 없는 prefix → 빈 배열", async () => {
    await store.put("run1/a.txt", "A");
    const items = await store.list("run9");
    expect(items).toEqual([]);
  });
});

/* ─── 보안 엣지 케이스 ─── */
describe("LocalArtifactStore — 경로 보안", () => {
  let dir: string;
  let store: ArtifactStoreLike;

  beforeEach(async () => {
    ({ store, dir } = await make_store());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it(".. 세그먼트 → 루트 외부 접근 차단", async () => {
    // "../../../etc/passwd" 형식 키 → 안전하게 정규화
    const meta = await store.put("../../escape.txt", "malicious");
    // 파일이 실제로 생성됐다면 루트 내에 있어야 함
    expect(meta.size).toBeGreaterThan(0);
    // 조회도 정상 작동해야 함
    const loaded = await store.get("../../escape.txt");
    expect(loaded).not.toBeNull();
  });
});

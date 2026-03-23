/**
 * embed.service.ts LRU 캐시 테스트.
 * 캐시 히트, TTL 만료, eviction, 혼합 배치 시나리오 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { create_embed_service } from "@src/services/embed.service.js";

function make_mock_response(embeddings: number[][], total_tokens = 10) {
  return {
    ok: true,
    json: async () => ({
      data: embeddings.map((embedding, index) => ({ embedding, index })),
      usage: { total_tokens },
    }),
    text: async () => "",
    status: 200,
  };
}

function make_service() {
  return create_embed_service({
    get_api_key: async () => "test-key",
    api_base: "https://test.api/v1",
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("임베딩 LRU 캐시", () => {
  it("같은 텍스트 2회 호출 시 API가 1회만 호출됨", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make_mock_response([[1, 2, 3]]) as unknown as Response);

    const embed = make_service();
    const opts = { model: "test-model" };

    const first = await embed(["hello"], opts);
    const second = await embed(["hello"], opts);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(first.embeddings).toEqual([[1, 2, 3]]);
    expect(second.embeddings).toEqual([[1, 2, 3]]);
  });

  it("TTL 만료 후 재호출 시 API 재호출", async () => {
    vi.useFakeTimers();

    vi.mocked(fetch)
      .mockResolvedValueOnce(make_mock_response([[1, 0]]) as unknown as Response)
      .mockResolvedValueOnce(make_mock_response([[2, 0]]) as unknown as Response);

    const embed = make_service();
    const opts = { model: "m" };

    await embed(["text"], opts);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // TTL(60초) 초과
    vi.advanceTimersByTime(61_000);

    await embed(["text"], opts);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("256 엔트리 초과 시 가장 오래된 항목 eviction", async () => {
    // 256개를 채운 뒤 1개 추가 → 최초 항목이 evict → 다시 호출 시 API 재호출
    const embed = make_service();
    const opts = { model: "m" };

    let fetch_call_count = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      fetch_call_count++;
      return make_mock_response([[fetch_call_count]]) as unknown as Response;
    });

    // 257개 각각 다른 텍스트 → 257번의 fetch (전부 캐시 미스)
    for (let i = 0; i < 257; i++) {
      await embed([`text-${i}`], opts);
    }
    // 캐시: text-1..text-256 (256개). text-0은 eviction됨.
    expect(fetch_call_count).toBe(257);

    // text-0은 eviction 되었으므로 캐시 미스 → API 재호출
    await embed(["text-0"], opts);
    expect(fetch_call_count).toBe(258);

    // text-256은 가장 최근 항목 → 캐시 히트 → API 호출 없음
    await embed(["text-256"], opts);
    expect(fetch_call_count).toBe(258);
  });

  it("혼합 배치 (캐시 히트 + 미스) 시 API 호출 텍스트 수가 미스 수와 동일", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        make_mock_response([[10, 20], [30, 40]]) as unknown as Response,
      )
      .mockResolvedValueOnce(
        make_mock_response([[50, 60]]) as unknown as Response,
      );

    const embed = make_service();
    const opts = { model: "m" };

    // 첫 호출: "a", "b" → 둘 다 캐시 미스 → API에 2개 전송
    await embed(["a", "b"], opts);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const first_body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(first_body.input).toEqual(["a", "b"]);

    // 두번째 호출: "a"(히트), "c"(미스), "b"(히트) → API에 "c"만 전송
    const result = await embed(["a", "c", "b"], opts);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

    const second_body = JSON.parse(String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body));
    expect(second_body.input).toEqual(["c"]);

    // 결과 순서 보장: a=>[10,20], c=>[50,60], b=>[30,40]
    expect(result.embeddings).toEqual([[10, 20], [50, 60], [30, 40]]);
  });

  it("다른 model/dimensions 조합은 별도 캐시 엔트리", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make_mock_response([[1]]) as unknown as Response)
      .mockResolvedValueOnce(make_mock_response([[2]]) as unknown as Response);

    const embed = make_service();

    await embed(["text"], { model: "model-a" });
    await embed(["text"], { model: "model-b" });

    // 다른 모델이므로 2번 호출
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("dimensions가 다르면 캐시 키가 다름", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make_mock_response([[1]]) as unknown as Response)
      .mockResolvedValueOnce(make_mock_response([[2]]) as unknown as Response);

    const embed = make_service();

    await embed(["text"], { model: "m", dimensions: 256 });
    await embed(["text"], { model: "m", dimensions: 512 });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("서로 다른 embed_service 인스턴스는 캐시를 공유하지 않음", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make_mock_response([[1]]) as unknown as Response)
      .mockResolvedValueOnce(make_mock_response([[2]]) as unknown as Response);

    const embed1 = make_service();
    const embed2 = make_service();

    await embed1(["text"], { model: "m" });
    await embed2(["text"], { model: "m" });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

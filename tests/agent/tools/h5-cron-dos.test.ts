/**
 * H-5: CronShellTool — "star-slash-0" DoS 방어 + dispose() 타이머 정리 테스트.
 *
 * Given: cron_to_interval_ms()가 제수(divisor) 0인 표현식을 받을 때
 * When : 분/시 필드에 제수 0(예: 매분 0) 표현식이 사용될 때
 * Then : null 반환 → setInterval(fn, 0) DoS 루프 방지
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { CronShellTool } from "@src/agent/tools/cron-shell.js";

/** 테스트용 CronShellTool 인스턴스를 생성한다. */
function make_tool(): CronShellTool {
  return new CronShellTool({ workspace: "/tmp/test-workspace" });
}

// cron_to_interval_ms는 private이므로 execute("register") 호출로 간접 검증한다.
// interval_ms가 null이면 "Error: only simple cron intervals supported" 반환.

describe("H-5: cron_to_interval_ms — 제수 0 DoS 방어", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("*/0 * * * * → null 반환 (분 제수 0 → 에러 메시지)", async () => {
    // Given: 분 필드에 */0이 있는 cron 표현식
    const tool = make_tool();
    // When: register 시도
    const result = await tool.execute({ operation: "register", id: "dos-min", expression: "*/0 * * * *", command: "echo test" });
    // Then: 유효하지 않은 표현식으로 처리되어 에러 반환
    expect(result).toContain("Error");
    expect(result).toContain("cron intervals");
  });

  it("0 */0 * * * → null 반환 (시 제수 0 → 에러 메시지)", async () => {
    // Given: 시 필드에 */0이 있는 cron 표현식
    const tool = make_tool();
    // When: register 시도
    const result = await tool.execute({ operation: "register", id: "dos-hour", expression: "0 */0 * * *", command: "echo test" });
    // Then: 유효하지 않은 표현식으로 처리되어 에러 반환
    expect(result).toContain("Error");
    expect(result).toContain("cron intervals");
  });

  it("*/5 * * * * → 300000ms (정상 케이스)", async () => {
    // Given: 5분 간격 cron 표현식 (정상)
    const tool = make_tool();
    // When: register 성공
    const result = await tool.execute({ operation: "register", id: "normal-5min", expression: "*/5 * * * *", command: "echo ok" });
    // Then: 등록 성공 + 간격 300초 확인
    expect(result).toContain("300");
    expect(result).not.toContain("Error");
    tool.dispose();
  });

  it("*/1 * * * * → 60000ms (최소 유효 간격)", async () => {
    // Given: 1분 간격 cron 표현식 (최솟값)
    const tool = make_tool();
    // When: register 성공
    const result = await tool.execute({ operation: "register", id: "min-1min", expression: "*/1 * * * *", command: "echo ok" });
    // Then: 등록 성공 + 간격 60초 확인
    expect(result).toContain("60");
    expect(result).not.toContain("Error");
    tool.dispose();
  });

  it("0 */2 * * * → 7200000ms (시간 정상 케이스)", async () => {
    // Given: 2시간 간격 cron 표현식 (정상)
    const tool = make_tool();
    // When: register 성공
    const result = await tool.execute({ operation: "register", id: "normal-2hr", expression: "0 */2 * * *", command: "echo ok" });
    // Then: 등록 성공 + 간격 7200초 확인
    expect(result).toContain("7200");
    expect(result).not.toContain("Error");
    tool.dispose();
  });
});

describe("H-5: dispose() — 타이머 정리", () => {
  it("dispose() 호출 시 등록된 모든 타이머가 clearInterval된다", async () => {
    // Given: 2개 작업이 등록된 CronShellTool
    const tool = make_tool();
    const clear_spy = vi.spyOn(globalThis, "clearInterval");

    await tool.execute({ operation: "register", id: "job-a", expression: "*/5 * * * *", command: "echo a" });
    await tool.execute({ operation: "register", id: "job-b", expression: "*/10 * * * *", command: "echo b" });

    // When: dispose() 호출
    tool.dispose();

    // Then: 2개 타이머 모두 clearInterval 호출됨
    expect(clear_spy).toHaveBeenCalledTimes(2);

    // Then: 작업 목록 비어있음
    const list_result = await tool.execute({ operation: "list" });
    expect(list_result).toContain("no scheduled jobs");
  });

  it("dispose() 후 list → '(no scheduled jobs)' 반환", async () => {
    // Given: 작업이 등록된 툴
    const tool = make_tool();
    await tool.execute({ operation: "register", id: "temp", expression: "*/5 * * * *", command: "ls" });

    // When: dispose 후 list
    tool.dispose();
    const result = await tool.execute({ operation: "list" });

    // Then: 빈 목록 메시지
    expect(result).toContain("no scheduled jobs");
  });
});

describe("H-5: register with */0 → 에러 응답", () => {
  it("*/0 표현식으로 register 시 Error 반환 (타이머 미생성)", async () => {
    // Given: DoS 위험 표현식
    const tool = make_tool();
    const set_spy = vi.spyOn(globalThis, "setInterval");

    // When: register 시도
    const result = await tool.execute({ operation: "register", id: "exploit", expression: "*/0 * * * *", command: "rm -rf /" });

    // Then: 에러 반환 + setInterval이 호출되지 않아야 함
    expect(result).toContain("Error");
    expect(set_spy).not.toHaveBeenCalled();
  });
});

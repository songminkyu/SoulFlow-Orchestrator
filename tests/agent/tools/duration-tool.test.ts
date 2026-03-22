/**
 * DurationTool — parse/format/to_ms/from_ms/add/subtract/humanize/compare 테스트.
 */
import { describe, it, expect } from "vitest";
import { DurationTool } from "../../../src/agent/tools/duration.js";

const tool = new DurationTool();

async function exec(params: Record<string, unknown>): Promise<unknown> {
  const result = await tool.execute(params);
  try { return JSON.parse(String(result)); } catch { return result; }
}

describe("DurationTool — parse", () => {
  it("ISO 8601 기간 파싱 (P1DT2H30M)", async () => {
    const r = await exec({ action: "parse", duration: "P1DT2H30M" }) as Record<string, unknown>;
    const parts = r.parts as Record<string, number>;
    expect(parts.days).toBe(1);
    expect(parts.hours).toBe(2);
    expect(parts.minutes).toBe(30);
    expect(r.ms).toBeGreaterThan(0);
  });

  it("자연어 기간 파싱 (2 hours 30 minutes)", async () => {
    const r = await exec({ action: "parse", duration: "2 hours 30 minutes" }) as Record<string, unknown>;
    const parts = r.parts as Record<string, number>;
    expect(parts.hours).toBe(2);
    expect(parts.minutes).toBe(30);
  });

  it("단축 표현 파싱 (1h30m)", async () => {
    const r = await exec({ action: "parse", duration: "1h 30m" }) as Record<string, unknown>;
    const parts = r.parts as Record<string, number>;
    expect(parts.hours).toBe(1);
    expect(parts.minutes).toBe(30);
  });

  it("잘못된 기간 → error", async () => {
    const r = await exec({ action: "parse", duration: "not-a-duration" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

describe("DurationTool — to_ms", () => {
  it("1시간 → 3600000ms", async () => {
    const r = await exec({ action: "to_ms", duration: "PT1H" }) as Record<string, unknown>;
    expect(r.ms).toBe(3600000);
    expect(r.seconds).toBe(3600);
  });

  it("1일 → 86400000ms", async () => {
    const r = await exec({ action: "to_ms", duration: "P1D" }) as Record<string, unknown>;
    expect(r.ms).toBe(86400000);
  });
});

describe("DurationTool — from_ms", () => {
  it("3600000ms → 1시간", async () => {
    const r = await exec({ action: "from_ms", ms: 3600000 }) as Record<string, unknown>;
    const parts = r.parts as Record<string, number>;
    expect(parts.hours).toBe(1);
  });

  it("90000ms → 1분 30초", async () => {
    const r = await exec({ action: "from_ms", ms: 90000 }) as Record<string, unknown>;
    const parts = r.parts as Record<string, number>;
    expect(parts.minutes).toBe(1);
    expect(parts.seconds).toBe(30);
  });

  it("ISO 형식 반환", async () => {
    const r = await exec({ action: "from_ms", ms: 3600000 }) as Record<string, unknown>;
    expect(String(r.iso)).toContain("H");
  });
});

describe("DurationTool — format", () => {
  it("ISO와 human 형식 모두 반환", async () => {
    const r = await exec({ action: "format", duration: "P1DT2H" }) as Record<string, unknown>;
    expect(r.iso).toBeDefined();
    expect(r.human).toBeDefined();
    expect(String(r.human)).toContain("hour");
  });
});

describe("DurationTool — add", () => {
  it("두 기간 합산", async () => {
    const r = await exec({ action: "add", duration: "PT1H", duration2: "PT30M" }) as Record<string, unknown>;
    expect(Number(r.ms)).toBe(5400000); // 1.5시간
  });

  it("잘못된 기간 → error", async () => {
    const r = await exec({ action: "add", duration: "invalid", duration2: "PT1H" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

describe("DurationTool — subtract", () => {
  it("기간 빼기", async () => {
    const r = await exec({ action: "subtract", duration: "PT2H", duration2: "PT30M" }) as Record<string, unknown>;
    expect(Number(r.ms)).toBe(5400000); // 1.5시간
  });

  it("음수 결과 → 0 (최솟값)", async () => {
    const r = await exec({ action: "subtract", duration: "PT1H", duration2: "PT2H" }) as Record<string, unknown>;
    expect(Number(r.ms)).toBe(0);
  });
});

describe("DurationTool — humanize", () => {
  it("사람이 읽기 쉬운 형식 반환", async () => {
    const r = await exec({ action: "humanize", duration: "P1DT2H30M" }) as Record<string, unknown>;
    const h = String(r.human);
    expect(h).toContain("day");
    expect(h).toContain("hour");
    expect(h).toContain("minute");
  });

  it("0s → '0 seconds'", async () => {
    const r = await exec({ action: "humanize", duration: "PT0S" }) as Record<string, unknown>;
    expect(r.human).toBe("0 seconds");
  });
});

describe("DurationTool — compare", () => {
  it("동일한 기간 → result: 0", async () => {
    const r = await exec({ action: "compare", duration: "PT1H", duration2: "PT60M" }) as Record<string, unknown>;
    expect(r.result).toBe(0);
    expect(r.equal).toBe(true);
  });

  it("a > b → result: 1", async () => {
    const r = await exec({ action: "compare", duration: "PT2H", duration2: "PT1H" }) as Record<string, unknown>;
    expect(r.result).toBe(1);
  });

  it("a < b → result: -1", async () => {
    const r = await exec({ action: "compare", duration: "PT1H", duration2: "PT2H" }) as Record<string, unknown>;
    expect(r.result).toBe(-1);
  });
});

describe("DurationTool — 파싱 실패 (L35, L40, L65)", () => {
  it("format: 잘못된 duration → error (L35)", async () => {
    const r = JSON.parse(await new (await import("@src/agent/tools/duration.js")).DurationTool().execute({ action: "format", duration: "not-a-duration" }));
    expect(r.error).toContain("cannot parse duration");
  });

  it("to_ms: 잘못된 duration → error (L40)", async () => {
    const r = JSON.parse(await new (await import("@src/agent/tools/duration.js")).DurationTool().execute({ action: "to_ms", duration: "invalid" }));
    expect(r.error).toContain("cannot parse duration");
  });

  it("humanize: 잘못된 duration → error (L65)", async () => {
    const r = JSON.parse(await new (await import("@src/agent/tools/duration.js")).DurationTool().execute({ action: "humanize", duration: "garbage" }));
    expect(r.error).toContain("cannot parse duration");
  });
});

// ══════════════════════════════════════════
// 미커버 분기 보충 (L58, L71, L76, L114, L146-148, L160-162)
// ══════════════════════════════════════════

describe("DurationTool — 미커버 분기", () => {
  it("subtract: 잘못된 duration → L58 error", async () => {
    const r = await exec({ action: "subtract", duration: "not-a-duration", duration2: "PT1H" }) as Record<string, unknown>;
    expect(r.error).toContain("cannot parse duration");
  });

  it("compare: 잘못된 duration → L71 error", async () => {
    const r = await exec({ action: "compare", duration: "garbage", duration2: "PT1H" }) as Record<string, unknown>;
    expect(r.error).toContain("cannot parse duration");
  });

  it("unknown action → L76 Error", async () => {
    const r = await tool.execute({ action: "unsupported_xyz" });
    expect(String(r)).toContain("Error");
    expect(String(r)).toContain("unsupported");
  });

  it("parse_duration: 숫자 문자열 → L114 from_ms (밀리초 직접 입력)", async () => {
    // input = "3600000" → !matched → ms=3600000 → from_ms
    const r = await exec({ action: "format", duration: "3600000" }) as Record<string, unknown>;
    expect(r.iso).toBeDefined();
  });

  it("to_iso: years/months/weeks 포함 → L146-148", async () => {
    // parse ISO with years/months/weeks → to_iso includes Y/M/W
    const r = await exec({ action: "format", duration: "P2Y3M1W5D" }) as Record<string, unknown>;
    expect(String(r.iso)).toContain("Y");
  });

  it("humanize: years/months/weeks 포함 → L160-162", async () => {
    const r = await exec({ action: "humanize", duration: "P1Y2M3W" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("year");
    expect(String(r.human)).toContain("month");
    expect(String(r.human)).toContain("week");
  });
});

// ══════════════════════════════════════════
// root merge: parse 숫자 문자열 / to_iso / humanize 단수 복수 / subtract·compare 실패 / 자연어
// ══════════════════════════════════════════

describe("DurationTool — parse: 숫자 문자열 → from_ms", () => {
  it("'3600000' (ms 숫자 문자열) → 파싱됨", async () => {
    const r = await exec({ action: "parse", duration: "3600000" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>).hours).toBe(1);
  });

  it("'0' → 파싱됨 (0ms)", async () => {
    const r = await exec({ action: "parse", duration: "0" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>)).toBeDefined();
    expect(r.ms).toBe(0);
  });
});

describe("DurationTool — to_iso: date_part 포함", () => {
  it("P1Y → ISO 'P1Y'", async () => {
    const r = await exec({ action: "format", duration: "P1Y" }) as Record<string, unknown>;
    expect(r.iso).toBe("P1Y");
  });

  it("P2M → ISO 'P2M'", async () => {
    const r = await exec({ action: "format", duration: "P2M" }) as Record<string, unknown>;
    expect(r.iso).toBe("P2M");
  });

  it("P3W → ISO 'P3W'", async () => {
    const r = await exec({ action: "format", duration: "P3W" }) as Record<string, unknown>;
    expect(r.iso).toBe("P3W");
  });

  it("P1Y2M3D → ISO 'P1Y2M3D'", async () => {
    const r = await exec({ action: "format", duration: "P1Y2M3D" }) as Record<string, unknown>;
    expect(r.iso).toBe("P1Y2M3D");
  });
});

describe("DurationTool — humanize: years/months/weeks 단수/복수", () => {
  it("P2Y → '2 years'", async () => {
    const r = await exec({ action: "humanize", duration: "P2Y" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("2 years");
  });

  it("P1Y → '1 year' (단수)", async () => {
    const r = await exec({ action: "humanize", duration: "P1Y" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("1 year");
    expect(String(r.human)).not.toContain("1 years");
  });

  it("P3M → '3 months'", async () => {
    const r = await exec({ action: "humanize", duration: "P3M" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("3 months");
  });

  it("P1M → '1 month' (단수)", async () => {
    const r = await exec({ action: "humanize", duration: "P1M" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("1 month");
    expect(String(r.human)).not.toContain("1 months");
  });

  it("P2W → '2 weeks'", async () => {
    const r = await exec({ action: "humanize", duration: "P2W" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("2 weeks");
  });

  it("P1W → '1 week' (단수)", async () => {
    const r = await exec({ action: "humanize", duration: "P1W" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("1 week");
    expect(String(r.human)).not.toContain("1 weeks");
  });
});

describe("DurationTool — subtract: duration2 파싱 실패", () => {
  it("duration2 invalid → error", async () => {
    const r = await exec({ action: "subtract", duration: "PT1H", duration2: "not-valid" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

describe("DurationTool — compare: duration2 파싱 실패", () => {
  it("duration2 invalid → error", async () => {
    const r = await exec({ action: "compare", duration: "PT1H", duration2: "not-valid" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

describe("DurationTool — parse: 자연어 year/month/week/sec", () => {
  it("'1 year' → years: 1", async () => {
    const r = await exec({ action: "parse", duration: "1 year" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>).years).toBe(1);
  });

  it("'2 months' → months: 2", async () => {
    const r = await exec({ action: "parse", duration: "2 months" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>).months).toBe(2);
  });

  it("'3 weeks' → weeks: 3", async () => {
    const r = await exec({ action: "parse", duration: "3 weeks" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>).weeks).toBe(3);
  });

  it("'30 seconds' → seconds: 30", async () => {
    const r = await exec({ action: "parse", duration: "30 seconds" }) as Record<string, unknown>;
    expect((r.parts as Record<string, number>).seconds).toBe(30);
  });
});

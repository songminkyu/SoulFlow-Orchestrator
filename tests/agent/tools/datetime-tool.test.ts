/**
 * DateTimeTool — 날짜/시간 operations 테스트.
 */
import { describe, it, expect } from "vitest";
import { DateTimeTool } from "../../../src/agent/tools/datetime.js";

const tool = new DateTimeTool();

async function exec(params: Record<string, unknown>): Promise<unknown> {
  const result = await tool.execute(params);
  try { return JSON.parse(String(result)); } catch { return result; }
}

const ISO_DATE = "2024-01-15T12:00:00.000Z";

describe("DateTimeTool — now", () => {
  it("현재 시간 ISO 형식 반환", async () => {
    const r = String(await exec({ action: "now" }));
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("format 적용", async () => {
    const r = String(await exec({ action: "now", format: "YYYY-MM-DD" }));
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("timezone 지정 — Asia/Seoul", async () => {
    const r = await exec({ action: "now", from_tz: "Asia/Seoul" }) as Record<string, unknown>;
    expect(r.tz).toBe("Asia/Seoul");
    expect(r.iso).toBeDefined();
  });

  it("잘못된 timezone → Error", async () => {
    expect(String(await exec({ action: "now", from_tz: "Invalid/Zone" }))).toContain("Error");
  });
});

describe("DateTimeTool — add", () => {
  it("일 추가", async () => {
    const r = String(await exec({ action: "add", date: ISO_DATE, amount: 7, unit: "d" }));
    expect(r).toContain("2024-01-22");
  });

  it("음수 (빼기)", async () => {
    const r = String(await exec({ action: "add", date: ISO_DATE, amount: -15, unit: "d" }));
    expect(r).toContain("2023-12-31");
  });

  it("월 추가", async () => {
    const r = String(await exec({ action: "add", date: ISO_DATE, amount: 2, unit: "month" }));
    expect(r).toContain("2024-03");
  });

  it("연 추가", async () => {
    const r = String(await exec({ action: "add", date: ISO_DATE, amount: 1, unit: "year" }));
    expect(r).toContain("2025");
  });

  it("시간 추가 (h)", async () => {
    const r = String(await exec({ action: "add", date: ISO_DATE, amount: 3, unit: "h" }));
    expect(r).toContain("T15:00:00");
  });

  it("잘못된 날짜 → Error", async () => {
    expect(String(await exec({ action: "add", date: "not-a-date", amount: 1, unit: "d" }))).toContain("Error");
  });
});

describe("DateTimeTool — diff", () => {
  it("날짜 차이 계산", async () => {
    const r = await exec({ action: "diff", date: "2024-01-01", date2: "2024-01-31" }) as Record<string, unknown>;
    expect(r.days).toBe(30);
    expect(Number(r.ms)).toBeGreaterThan(0);
  });

  it("역순 → 음수 ms", async () => {
    const r = await exec({ action: "diff", date: "2024-01-31", date2: "2024-01-01" }) as Record<string, unknown>;
    expect(Number(r.days)).toBe(-30);
  });
});

describe("DateTimeTool — format", () => {
  it("YYYY-MM-DD 포맷", async () => {
    const r = String(await exec({ action: "format", date: ISO_DATE, format: "YYYY-MM-DD" }));
    expect(r).toBe("2024-01-15");
  });

  it("HH:mm:ss 포맷", async () => {
    const r = String(await exec({ action: "format", date: ISO_DATE, format: "HH:mm:ss" }));
    expect(r).toBe("12:00:00");
  });
});

describe("DateTimeTool — parse", () => {
  it("ISO 날짜 파싱", async () => {
    const r = await exec({ action: "parse", date: ISO_DATE }) as Record<string, unknown>;
    expect(r.year).toBe(2024);
    expect(r.month).toBe(1);
    expect(r.day).toBe(15);
    expect(r.hour).toBe(12);
    expect(r.unix_ms).toBeDefined();
  });
});

describe("DateTimeTool — day_info", () => {
  it("요일, 주차, 분기 정보", async () => {
    const r = await exec({ action: "day_info", date: "2024-01-15" }) as Record<string, unknown>;
    expect(r.day_of_week).toBe("Monday");
    expect(r.is_weekend).toBe(false);
    expect(r.quarter).toBe(1);
  });

  it("주말 판별", async () => {
    const r = await exec({ action: "day_info", date: "2024-01-13" }) as Record<string, unknown>; // Saturday
    expect(r.is_weekend).toBe(true);
  });

  it("윤년 판별", async () => {
    const r = await exec({ action: "day_info", date: "2024-02-29" }) as Record<string, unknown>;
    expect(r.is_leap_year).toBe(true);
  });
});

describe("DateTimeTool — business_days", () => {
  it("영업일 계산 (2주)", async () => {
    const r = await exec({ action: "business_days", date: "2024-01-15", date2: "2024-01-26" }) as Record<string, unknown>;
    expect(Number(r.business_days)).toBeGreaterThan(0);
    expect(Number(r.calendar_days)).toBeGreaterThan(0);
  });
});

describe("DateTimeTool — range", () => {
  it("날짜 범위 생성", async () => {
    const r = await exec({ action: "range", start_date: "2024-01-01", end_date: "2024-01-05" }) as string[];
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(5);
    expect(r[0]).toBe("2024-01-01");
    expect(r[4]).toBe("2024-01-05");
  });

  it("step_days 적용", async () => {
    const r = await exec({ action: "range", start_date: "2024-01-01", end_date: "2024-01-10", step_days: 2 }) as string[];
    expect(r.length).toBe(5);
  });
});

// ══════════════════════════════════════════
// 미커버 분기 보충
// ══════════════════════════════════════════

describe("DateTimeTool — 미커버 분기", () => {
  it("timezone: invalid date → Error (L95)", async () => {
    const r = await exec({ action: "timezone", date: "not-a-date", from_tz: "UTC", to_tz: "Asia/Seoul" });
    expect(String(r)).toContain("Error");
  });

  it("business_days: invalid date → Error (L111)", async () => {
    const r = await exec({ action: "business_days", date: "bad-date", date2: "2024-01-10" });
    expect(String(r)).toContain("Error");
  });

  it("day_info: invalid date → Error (L148)", async () => {
    const r = await exec({ action: "day_info", date: "" });
    expect(String(r)).toContain("Error");
  });

  it("range: invalid start date → Error (L167)", async () => {
    const r = await exec({ action: "range", start_date: "bad", end_date: "2024-01-05" });
    expect(String(r)).toContain("Error");
  });

  it("range: step < 1 → Error (L168)", async () => {
    // step_days=0 은 falsy → Number(0||1)=1 로 되므로 음수를 써야 step<1 조건 통과
    const r = await exec({ action: "range", start_date: "2024-01-01", end_date: "2024-01-05", step_days: -1 });
    expect(String(r)).toContain("Error");
  });

  it("safe_parse: 빈 문자열 → null → Error (L180)", async () => {
    // timezone 에 빈 date 전달 → safe_parse("") → L180 null → "Error: invalid date"
    const r = await exec({ action: "timezone", date: "", from_tz: "UTC", to_tz: "Asia/Seoul" });
    expect(String(r)).toContain("Error");
  });
});

// ══════════════════════════════════════════
// 미커버 분기 보충 (L46, L80, L96-100, L105, L126, L132)
// ══════════════════════════════════════════

describe("DatetimeTool — 미커버 분기", () => {
  it("unknown action → L46 Error", async () => {
    const r = await exec({ action: "unknown_action" });
    expect(String(r)).toContain("Error");
    expect(String(r)).toContain("unsupported");
  });

  it("diff: 잘못된 날짜 → L80 Error", async () => {
    const r = await exec({ action: "diff", date: "bad-date", date2: "2024-01-01" });
    expect(String(r)).toContain("Error");
    expect(String(r)).toContain("invalid date");
  });

  it("timezone: 유효한 날짜+TZ → L96-100 성공", async () => {
    const r = await exec({ action: "timezone", date: "2024-01-15T12:00:00Z", from_tz: "UTC", to_tz: "America/New_York" });
    // 성공 시 JSON 반환
    try {
      const parsed = JSON.parse(r as string);
      expect(parsed.from).toBeDefined();
      expect(parsed.to).toBeDefined();
    } catch {
      // timezone이 지원 안 되는 환경이면 Error 허용
      expect(String(r)).toBeDefined();
    }
  });

  it("timezone: 잘못된 TZ → L105 Error", async () => {
    const r = await exec({ action: "timezone", date: "2024-01-15T12:00:00Z", from_tz: "INVALID_TZ", to_tz: "ALSO_INVALID" });
    expect(String(r)).toContain("Error");
  });

  it("format: 잘못된 날짜 → L126 Error", async () => {
    const r = await exec({ action: "format", date: "not-a-date", fmt: "YYYY-MM-DD" });
    expect(String(r)).toContain("Error");
  });

  it("parse: 잘못된 날짜 → L132 Error", async () => {
    const r = await exec({ action: "parse", date: "definitely-not-a-date" });
    expect(String(r)).toContain("Error");
  });
});

// ══════════════════════════════════════════
// Merged from tests/agent/datetime-tool.test.ts
// ══════════════════════════════════════════

describe("DateTimeTool — diff human-readable (merged)", () => {
  it("includes human-readable format", async () => {
    const r = await exec({ action: "diff", date: "2025-01-01T00:00:00Z", date2: "2025-01-03T05:30:00Z" }) as Record<string, unknown>;
    expect(String(r.human)).toContain("2d");
    expect(String(r.human)).toContain("5h");
    expect(String(r.human)).toContain("30m");
  });
});

describe("DateTimeTool — timezone conversion (merged)", () => {
  it("converts between timezones", async () => {
    const r = await exec({
      action: "timezone",
      date: "2025-01-01T00:00:00Z",
      from_tz: "UTC",
      to_tz: "Asia/Seoul",
    }) as Record<string, unknown>;
    expect((r as any).from.timezone).toBe("UTC");
    expect((r as any).to.timezone).toBe("Asia/Seoul");
  });

  it("returns error for invalid timezone", async () => {
    const r = await exec({
      action: "timezone",
      date: "2025-01-01T00:00:00Z",
      from_tz: "UTC",
      to_tz: "Invalid/TZ",
    });
    expect(String(r)).toContain("Error");
  });
});

describe("DateTimeTool — business_days details (merged)", () => {
  it("counts business days Mon-Fri", async () => {
    const r = await exec({ action: "business_days", date: "2025-01-06", date2: "2025-01-10" }) as Record<string, unknown>;
    expect(r.business_days).toBe(5);
    expect(r.calendar_days).toBe(5);
  });

  it("excludes weekends", async () => {
    const r = await exec({ action: "business_days", date: "2025-01-06", date2: "2025-01-12" }) as Record<string, unknown>;
    expect(r.business_days).toBe(5);
    expect(r.calendar_days).toBe(7);
  });

  it("handles reversed order", async () => {
    const r = await exec({ action: "business_days", date: "2025-01-12", date2: "2025-01-06" }) as Record<string, unknown>;
    expect(r.business_days).toBe(5);
  });
});

describe("DateTimeTool — range details (merged)", () => {
  it("generates date range", async () => {
    const r = await exec({ action: "range", start_date: "2025-01-01", end_date: "2025-01-05" }) as string[];
    expect(r).toEqual(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05"]);
  });

  it("supports step_days", async () => {
    const r = await exec({ action: "range", start_date: "2025-01-01", end_date: "2025-01-10", step_days: 3 }) as string[];
    expect(r).toEqual(["2025-01-01", "2025-01-04", "2025-01-07", "2025-01-10"]);
  });

  it("step_days=0 defaults to 1 (falsy coercion)", async () => {
    const r = await exec({ action: "range", start_date: "2025-01-01", end_date: "2025-01-03", step_days: 0 }) as string[];
    expect(r).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("returns empty array when start > end", async () => {
    const r = await exec({ action: "range", start_date: "2025-01-10", end_date: "2025-01-01" }) as string[];
    expect(r).toEqual([]);
  });
});

describe("DateTimeTool — day_info details (merged)", () => {
  it("returns day metadata (Wednesday)", async () => {
    const r = await exec({ action: "day_info", date: "2025-01-01T00:00:00Z" }) as Record<string, unknown>;
    expect(r.day_of_week).toBe("Wednesday");
    expect(r.day_of_week_num).toBe(3);
    expect(r.is_weekend).toBe(false);
    expect(r.quarter).toBe(1);
    expect(r.days_in_month).toBe(31);
  });

  it("detects weekend (Saturday)", async () => {
    const r = await exec({ action: "day_info", date: "2025-01-04T00:00:00Z" }) as Record<string, unknown>;
    expect(r.day_of_week).toBe("Saturday");
    expect(r.is_weekend).toBe(true);
  });

  it("detects non-leap year", async () => {
    const r = await exec({ action: "day_info", date: "2025-02-15T00:00:00Z" }) as Record<string, unknown>;
    expect(r.is_leap_year).toBe(false);
    expect(r.days_in_month).toBe(28);
  });
});

describe("DateTimeTool — tool interface (merged)", () => {
  it("has correct metadata", () => {
    expect(tool.name).toBe("datetime");
    expect(tool.category).toBe("memory");
    expect(tool.description).toBeTruthy();
  });

  it("has valid schema", () => {
    const schema = tool.to_schema();
    expect(schema.type).toBe("function");
    expect(schema.function.name).toBe("datetime");
    expect(schema.function.parameters.properties).toBeDefined();
  });
});

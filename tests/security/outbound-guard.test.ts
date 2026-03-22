/**
 * IC-1: OutboundRequestGuardLike port — allowlist/deny regression test.
 * create_outbound_guard, create_guard_from_integration_settings,
 * 및 http-utils.check_allowed_hosts port 경유 검증.
 */
import { describe, it, expect } from "vitest";
import {
  create_outbound_guard,
  create_guard_from_integration_settings,
} from "@src/security/outbound-guard.js";
import { check_allowed_hosts } from "@src/agent/tools/http-utils.js";

// ══════════════════════════════════════════
// create_outbound_guard
// ══════════════════════════════════════════

describe("create_outbound_guard", () => {
  it("빈 config → 모든 URL 차단 + trust_zone=internal", () => {
    const guard = create_outbound_guard();
    expect(guard.is_allowed("https://api.github.com/repos")).toBe(false);
    expect(guard.get_trust_zone()).toBe("internal");
    expect(guard.get_allowed_hosts()).toEqual([]);
  });

  it("allowed_hosts 포함 → 정확히 일치하는 호스트만 허용", () => {
    const guard = create_outbound_guard({ allowed_hosts: ["api.github.com", "hooks.slack.com"] });
    expect(guard.is_allowed("https://api.github.com/v3/repos")).toBe(true);
    expect(guard.is_allowed("https://hooks.slack.com/services/abc")).toBe(true);
    expect(guard.is_allowed("https://evil.example.com/steal")).toBe(false);
    expect(guard.is_allowed("https://notgithub.com")).toBe(false);
  });

  it("trust_zone 설정 반영", () => {
    const guard = create_outbound_guard({ allowed_hosts: ["api.github.com"], trust_zone: "private" });
    expect(guard.get_trust_zone()).toBe("private");
  });

  it("잘못된 URL → false 반환 (throw 없음)", () => {
    const guard = create_outbound_guard({ allowed_hosts: ["api.github.com"] });
    expect(guard.is_allowed("not-a-url")).toBe(false);
    expect(guard.is_allowed("")).toBe(false);
  });

  it("빈 문자열 호스트는 필터링됨", () => {
    const guard = create_outbound_guard({ allowed_hosts: ["", "api.github.com"] });
    // "" → String("").filter(Boolean) 제거
    expect(guard.get_allowed_hosts().length).toBe(1);
    expect(guard.get_allowed_hosts()[0]).toBe("api.github.com");
  });

  it("IPv6 브래킷 포함 URL 처리", () => {
    const guard = create_outbound_guard({ allowed_hosts: ["::1"] });
    // ::1은 사설 주소이지만 guard는 단순 allowlist 비교 — 허용 처리
    expect(guard.is_allowed("https://[::1]/path")).toBe(true);
  });
});

// ══════════════════════════════════════════
// create_guard_from_integration_settings
// ══════════════════════════════════════════

describe("create_guard_from_integration_settings", () => {
  it("settings.allowed_hosts 배열 → 정상 허용", () => {
    const guard = create_guard_from_integration_settings({ allowed_hosts: ["api.github.com"] });
    expect(guard.is_allowed("https://api.github.com/user")).toBe(true);
    expect(guard.is_allowed("https://other.com")).toBe(false);
  });

  it("settings undefined → 차단", () => {
    const guard = create_guard_from_integration_settings(undefined);
    expect(guard.is_allowed("https://api.github.com")).toBe(false);
    expect(guard.get_allowed_hosts()).toEqual([]);
  });

  it("settings.allowed_hosts가 배열이 아닌 경우 → 차단", () => {
    const guard = create_guard_from_integration_settings({ allowed_hosts: "api.github.com" as unknown as unknown[] });
    expect(guard.is_allowed("https://api.github.com")).toBe(false);
  });

  it("trust_zone 파라미터 전달", () => {
    const guard = create_guard_from_integration_settings({ allowed_hosts: ["api.github.com"] }, "public");
    expect(guard.get_trust_zone()).toBe("public");
  });
});

// ══════════════════════════════════════════
// check_allowed_hosts (port 경유 regression)
// ══════════════════════════════════════════

describe("check_allowed_hosts (port 경유)", () => {
  it("설정된 호스트 → null (허용)", () => {
    const settings = { allowed_hosts: ["api.github.com"] };
    expect(check_allowed_hosts("api.github.com", settings, "github")).toBeNull();
  });

  it("미허용 호스트 → 에러 메시지", () => {
    const settings = { allowed_hosts: ["api.github.com"] };
    const result = check_allowed_hosts("evil.com", settings, "github");
    expect(result).toMatch(/not in allowed_hosts/);
    expect(result).toMatch(/evil\.com/);
  });

  it("allowed_hosts 미설정 → 설정 요청 메시지", () => {
    const result = check_allowed_hosts("api.github.com", {}, "github");
    expect(result).toMatch(/allowed_hosts not configured/);
    expect(result).toMatch(/github/);
  });

  it("settings undefined → 설정 요청 메시지", () => {
    const result = check_allowed_hosts("api.github.com", undefined, "my-service");
    expect(result).toMatch(/allowed_hosts not configured/);
    expect(result).toMatch(/my-service/);
  });

  it("빈 배열 → 설정 요청 메시지", () => {
    const result = check_allowed_hosts("api.github.com", { allowed_hosts: [] }, "svc");
    expect(result).toMatch(/allowed_hosts not configured/);
  });

  it("service_id가 에러 메시지에 포함됨", () => {
    const result = check_allowed_hosts("bad.com", { allowed_hosts: ["good.com"] }, "my-oauth");
    expect(result).toMatch(/my-oauth/);
  });
});

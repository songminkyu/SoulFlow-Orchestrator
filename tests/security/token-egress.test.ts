/**
 * SH-2 Token Egress Guard 회귀 테스트.
 *
 * - oauth_fetch_service (bootstrap/orchestration.ts): allowed_hosts 검증
 * - HttpRequestTool: auth 사용 시 HTTPS 강제
 * - OAuthFetchTool: allowed_hosts 검증 (기존 구현 확인)
 */
import { describe, it, expect, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════
// 1. HttpRequestTool — auth + HTTPS 강제
// ══════════════════════════════════════════════════════════════════

import { HttpRequestTool } from "@src/agent/tools/http-request.js";

describe("SH-2 — HttpRequestTool HTTPS 전용", () => {
  const tool = new HttpRequestTool();

  it("HTTP 요청 → 무조건 차단 (헤더/auth 무관)", async () => {
    const result = await (tool as any).run({ url: "http://example.com/api" });
    expect(result).toContain("HTTPS");
  });

  it("HTTP + auth → 차단", async () => {
    const result = await (tool as any).run({
      url: "http://example.com/api",
      auth: { type: "bearer", token: "secret" },
    });
    expect(result).toContain("HTTPS");
  });

  it("HTTP + 비밀 헤더(X-API-Key) → 차단", async () => {
    const result = await (tool as any).run({
      url: "http://example.com/api",
      headers: { "X-API-Key": "secret" },
    });
    expect(result).toContain("HTTPS");
  });

  it("HTTP + value-smuggling (User-Agent에 비밀 값) → 차단", async () => {
    const result = await (tool as any).run({
      url: "http://example.com/api",
      headers: { "User-Agent": "secret-token" },
    });
    expect(result).toContain("HTTPS");
  });

  it("HTTP + value-smuggling (Referer에 비밀 값) → 차단", async () => {
    const result = await (tool as any).run({
      url: "http://example.com/api",
      headers: { "Referer": "secret-token" },
    });
    expect(result).toContain("HTTPS");
  });

  it("HTTPS + auth → 허용", async () => {
    const result = await (tool as any).run({
      url: "https://httpbin.org/get",
      auth: { type: "bearer", token: "test" },
      timeout_ms: 1000,
    });
    expect(result).not.toContain("requires HTTPS");
  });

  it("SSRF 사설 호스트 → HTTPS여도 차단", async () => {
    const result = await (tool as any).run({
      url: "https://127.0.0.1/api",
      auth: { type: "bearer", token: "secret" },
    });
    expect(result).toContain("private/loopback host blocked");
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. oauth_fetch_service — allowed_hosts 검증
// ══════════════════════════════════════════════════════════════════

import { check_allowed_hosts } from "@src/agent/tools/http-utils.js";

describe("SH-2 — check_allowed_hosts (oauth_fetch_service + OAuthFetchTool 공유 헬퍼)", () => {
  // oauth_fetch_service(orchestration.ts)와 OAuthFetchTool이 동일한 check_allowed_hosts를 사용.

  it("allowed_hosts 미설정 → 차단", () => {
    expect(check_allowed_hosts("api.github.com", undefined, "test")).toContain("not configured");
    expect(check_allowed_hosts("api.github.com", {}, "test")).toContain("not configured");
    expect(check_allowed_hosts("api.github.com", { allowed_hosts: [] }, "test")).toContain("not configured");
  });

  it("allowed_hosts에 포함된 호스트 → 허용", () => {
    expect(check_allowed_hosts("api.github.com", { allowed_hosts: ["api.github.com"] }, "github")).toBeNull();
  });

  it("allowed_hosts에 미포함된 호스트 → 차단", () => {
    const result = check_allowed_hosts("evil.com", { allowed_hosts: ["api.github.com"] }, "github");
    expect(result).toContain("evil.com");
    expect(result).toContain("not in allowed_hosts");
  });

  it("여러 호스트 허용", () => {
    const settings = { allowed_hosts: ["api.github.com", "api.slack.com"] };
    expect(check_allowed_hosts("api.github.com", settings, "multi")).toBeNull();
    expect(check_allowed_hosts("api.slack.com", settings, "multi")).toBeNull();
    expect(check_allowed_hosts("evil.com", settings, "multi")).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. OAuthFetchTool — allowed_hosts 기존 구현 확인
// ══════════════════════════════════════════════════════════════════

describe("SH-2 — OAuthFetchTool allowed_hosts 회귀", () => {
  it("allowed_hosts 미설정 시 fetch 차단", async () => {
    const mock_store = {
      get: vi.fn().mockReturnValue({
        instance_id: "github",
        enabled: true,
        settings: {},
      }),
      list: vi.fn().mockReturnValue([]),
    };
    const mock_flow = {
      get_valid_access_token: vi.fn(),
    };

    const { OAuthFetchTool } = await import("@src/agent/tools/oauth-fetch.js");
    const tool = new OAuthFetchTool(mock_store as any, mock_flow as any);
    const result = await (tool as any).run({
      service_id: "github",
      url: "https://api.github.com/user",
    });
    expect(result).toContain("allowed_hosts not configured");
    // get_valid_access_token이 호출되지 않아야 함 (토큰 조회 전 차단)
    expect(mock_flow.get_valid_access_token).not.toHaveBeenCalled();
  });

  it("allowed_hosts에 미포함된 호스트 → 차단", async () => {
    const mock_store = {
      get: vi.fn().mockReturnValue({
        instance_id: "github",
        enabled: true,
        settings: { allowed_hosts: ["api.github.com"] },
      }),
      list: vi.fn().mockReturnValue([]),
    };
    const mock_flow = {
      get_valid_access_token: vi.fn(),
    };

    const { OAuthFetchTool } = await import("@src/agent/tools/oauth-fetch.js");
    const tool = new OAuthFetchTool(mock_store as any, mock_flow as any);
    const result = await (tool as any).run({
      service_id: "github",
      url: "https://evil.com/steal",
    });
    expect(result).toContain("not in allowed_hosts");
    expect(mock_flow.get_valid_access_token).not.toHaveBeenCalled();
  });
});

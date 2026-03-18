/**
 * H-8: 로그인 rate limiter 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { LoginRateLimiter } from "../../src/auth/login-rate-limiter.js";

describe("LoginRateLimiter", () => {
  it("max_attempts 이내면 허용", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 3, window_ms: 60_000 });
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(true);
    expect(limiter.check("ip1")).toBe(true);
  });

  it("max_attempts 초과 시 차단", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 2, window_ms: 60_000 });
    limiter.check("ip1");
    limiter.check("ip1");
    expect(limiter.check("ip1")).toBe(false);
  });

  it("다른 IP는 독립적", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 1, window_ms: 60_000 });
    limiter.check("ip1");
    expect(limiter.check("ip1")).toBe(false);
    expect(limiter.check("ip2")).toBe(true);
  });

  it("remaining() — 남은 시도 횟수", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 3, window_ms: 60_000 });
    expect(limiter.remaining("ip1")).toBe(3);
    limiter.check("ip1");
    expect(limiter.remaining("ip1")).toBe(2);
    limiter.check("ip1");
    limiter.check("ip1");
    expect(limiter.remaining("ip1")).toBe(0);
  });

  it("retry_after_ms() — 차단 시 대기 시간 반환", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 1, window_ms: 10_000 });
    expect(limiter.retry_after_ms("ip1")).toBe(0);
    limiter.check("ip1");
    const wait = limiter.retry_after_ms("ip1");
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(10_000);
  });

  it("윈도우 만료 후 다시 허용", () => {
    const limiter = new LoginRateLimiter({ max_attempts: 1, window_ms: 1 });
    limiter.check("ip1");
    // 1ms 윈도우이므로 즉시 만료
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(limiter.check("ip1")).toBe(true);
        resolve();
      }, 10);
    });
  });
});

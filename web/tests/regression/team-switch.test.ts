/**
 * FE-4/G-2: team-switch invalidation 계약 테스트.
 * useSwitchTeam이 auth-status를 제외한 전체 쿼리를 invalidate하는지 소스 코드를 검증한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_SRC = readFileSync(resolve("src/hooks/use-auth.ts"), "utf8");

describe("useSwitchTeam — 쿼리 invalidation 계약 (G-2)", () => {
  it("auth-status를 제외하는 predicate가 존재한다", () => {
    expect(AUTH_SRC).toContain('query.queryKey[0] !== "auth-status"');
  });

  it("특정 키만 invalidate하는 패턴이 아니다 (과거 패턴 방지)", () => {
    // 이전 구현: invalidateQueries({ queryKey: ["auth-me"] }) + invalidateQueries({ queryKey: ["scoped-providers"] })
    // 이제는 predicate 기반 전체 invalidation이어야 한다.
    const switch_block = AUTH_SRC.slice(AUTH_SRC.indexOf("useSwitchTeam"));
    // "auth-me" 또는 "scoped-providers" 키 직접 지정이 없어야 한다 (switchTeam 블록 안에서)
    const onSuccess_start = switch_block.indexOf("onSuccess");
    const block_end = switch_block.indexOf("});", onSuccess_start);
    const onSuccess_body = switch_block.slice(onSuccess_start, block_end);
    expect(onSuccess_body).not.toContain('"auth-me"');
    expect(onSuccess_body).not.toContain('"scoped-providers"');
  });
});

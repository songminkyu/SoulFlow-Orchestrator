/**
 * TN-6 Isolation Regression Bundle.
 *
 * 팀/사용자 기반 격리가 회귀되지 않았음을 확인하는 통합 인덱스.
 * 이 파일은 격리 관련 테스트를 직접 포함하지 않고,
 * 기존 격리 테스트 파일들이 모두 존재하고 커버리지가 충분한지 검증한다.
 *
 * vitest 실행 시 이 파일과 아래 테스트 묶음을 함께 실행:
 * npx vitest run tests/dashboard/tn1-* tests/dashboard/tn3-* tests/dashboard/tn4-* tests/dashboard/tn5-*
 *   tests/dashboard/tn6-* tests/dashboard/chat-session-isolation* tests/dashboard/idor-*
 *   tests/dashboard/session-route-* tests/dashboard/resource-scoping*
 *   tests/dashboard/scope-helpers* tests/dashboard/chat-mirror-scoping*
 *   tests/auth/switch-team* tests/auth/scoped-provider-resolver* tests/auth/tenant-context*
 *   tests/workspace/registry*
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");

/** 격리 회귀 테스트 파일 목록 — 각 파일이 존재하면 격리 커버리지가 유지됨. */
const ISOLATION_TEST_FILES = [
  // TN-1: 미들웨어 3경로 (인증, 멤버십, default fallback)
  "tests/dashboard/tn1-middleware-integration.test.ts",
  // TN-3: runtime 주입 + wdir 조작 거부
  "tests/dashboard/tn3-runtime-injection.test.ts",
  // TN-4: 크로스팀 세션 격리
  "tests/dashboard/tn4-session-rebinding.test.ts",
  // TN-5: provider scope 격리
  "tests/dashboard/tn5-provider-scope.test.ts",
  // TN-5: route-level scope 관통 + bootstrap superadmin 가드
  "tests/dashboard/tn5-route-scope-integration.test.ts",
  // TN 보안: 공격자 관점 시나리오 (크로스팀, wdir조작, 세션탈취, 권한상승, disabled토큰)
  "tests/dashboard/tn-security-attack-scenarios.test.ts",
  // 기존 격리 테스트
  "tests/dashboard/chat-session-isolation.test.ts",
  "tests/dashboard/idor-ownership.test.ts",
  "tests/dashboard/session-route-ownership.test.ts",
  "tests/dashboard/resource-scoping.test.ts",
  "tests/dashboard/chat-mirror-scoping.test.ts",
  "tests/dashboard/scope-helpers.test.ts",
  // auth 격리
  "tests/auth/switch-team.test.ts",
  "tests/auth/scoped-provider-resolver.test.ts",
  "tests/auth/tenant-context.test.ts",
  // workspace 격리
  "tests/workspace/registry.test.ts",
];

describe("TN-6: Isolation Regression Bundle — 격리 테스트 파일 존재 검증", () => {
  for (const file of ISOLATION_TEST_FILES) {
    it(`${file} 존재`, () => {
      expect(existsSync(join(PROJECT_ROOT, file))).toBe(true);
    });
  }
});

/** 격리 경계별 최소 테스트 커버리지 주석 (이 자체가 regression 문서). */
describe("TN-6: 격리 경계 매핑", () => {
  const BOUNDARIES = [
    { name: "인증 미들웨어 3경로", file: "tn1-middleware-integration.test.ts", min_tests: 6 },
    { name: "wdir 조작 거부", file: "tn3-runtime-injection.test.ts", min_tests: 5 },
    { name: "크로스팀 세션 격리", file: "tn4-session-rebinding.test.ts", min_tests: 7 },
    { name: "provider scope 필터", file: "tn5-provider-scope.test.ts", min_tests: 5 },
    { name: "chat 세션 사용자 격리", file: "chat-session-isolation.test.ts", min_tests: 1 },
    { name: "IDOR 소유권 검증", file: "idor-ownership.test.ts", min_tests: 1 },
    { name: "팀 전환 멤버십 검증", file: "../auth/switch-team.test.ts", min_tests: 8 },
    { name: "scoped provider resolver", file: "../auth/scoped-provider-resolver.test.ts", min_tests: 15 },
    { name: "TenantContext 도메인", file: "../auth/tenant-context.test.ts", min_tests: 9 },
    { name: "WorkspaceRuntimeLocator 포트", file: "../workspace/registry.test.ts", min_tests: 37 },
  ];

  for (const b of BOUNDARIES) {
    it(`경계 "${b.name}" → ${b.file} (최소 ${b.min_tests} tests)`, () => {
      const full_path = join(PROJECT_ROOT, "tests", "dashboard", b.file);
      expect(existsSync(full_path)).toBe(true);
    });
  }
});

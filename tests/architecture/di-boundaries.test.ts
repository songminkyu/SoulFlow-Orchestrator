/**
 * DI Boundary regression test — concrete service import가 허용된 팩토리/bootstrap 밖으로
 * 누출되지 않았는지 정적으로 검증.
 *
 * PA-1 scope: SecretVaultService, OrchestrationService
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(__dirname, "..", "..", "src");

/** src/ 하위 모든 .ts 파일 경로 수집 (재귀). */
function collect_ts_files(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...collect_ts_files(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      result.push(full);
    }
  }
  return result;
}

/**
 * 주어진 정규식에 매칭되는 non-type import를 가진 파일 목록 반환.
 * `import type { X }` 형태는 제외 — 런타임 의존성이 아님.
 */
function find_concrete_imports(files: string[], pattern: RegExp): string[] {
  const violators: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    for (const line of content.split("\n")) {
      // import type은 제외
      if (/^\s*import\s+type\b/.test(line)) continue;
      if (pattern.test(line)) {
        violators.push(relative(SRC, file).replaceAll(sep, "/"));
        break;
      }
    }
  }
  return violators;
}

describe("DI boundary — concrete service import confinement", () => {
  const all_files = collect_ts_files(SRC);

  it("SecretVaultService concrete import는 정의 파일 + 팩토리에만 존재", () => {
    const allowed = new Set([
      "security/secret-vault.ts",        // 클래스 정의
      "security/secret-vault-factory.ts", // 팩토리 (new SecretVaultService)
    ]);

    const violators = find_concrete_imports(
      all_files,
      /import\s*\{[^}]*\bSecretVaultService\b/,
    ).filter((f) => !allowed.has(f));

    expect(violators, `SecretVaultService concrete import 누출: ${violators.join(", ")}`).toEqual([]);
  });

  it("OrchestrationService concrete import는 정의 파일 + bootstrap에만 존재", () => {
    const allowed = new Set([
      "orchestration/service.ts",       // 클래스 정의
      "bootstrap/orchestration.ts",     // composition root (new OrchestrationService)
    ]);

    const violators = find_concrete_imports(
      all_files,
      /import\s*\{[^}]*\bOrchestrationService\b/,
    ).filter((f) => !allowed.has(f));

    expect(violators, `OrchestrationService concrete import 누출: ${violators.join(", ")}`).toEqual([]);
  });

  it("DashboardService concrete import는 정의 파일 + bootstrap + main에만 존재", () => {
    const allowed = new Set([
      "dashboard/service.ts",
      "bootstrap/dashboard.ts",
      "main.ts",
    ]);
    const violators = find_concrete_imports(
      all_files,
      /import\s*\{[^}]*\bDashboardService\b/,
    ).filter((f) => !allowed.has(f));
    expect(violators, `DashboardService concrete import 누출: ${violators.join(", ")}`).toEqual([]);
  });

  it("ChannelManager concrete import는 정의 파일 + bootstrap + main에만 존재", () => {
    const allowed = new Set([
      "channels/manager.ts",
      "bootstrap/channel-wiring.ts",
      "bootstrap/channels.ts",
      "main.ts",
    ]);
    const violators = find_concrete_imports(
      all_files,
      /import\s*\{[^}]*\bChannelManager\b/,
    ).filter((f) => !allowed.has(f));
    expect(violators, `ChannelManager concrete import 누출: ${violators.join(", ")}`).toEqual([]);
  });

  it("CronService concrete import는 정의 파일 + bootstrap + main에만 존재", () => {
    const allowed = new Set([
      "cron/service.ts",
      "cron/index.ts",
      "bootstrap/orchestration.ts",
      "main.ts",
    ]);
    const violators = find_concrete_imports(
      all_files,
      /import\s*\{[^}]*\bCronService\b/,
    ).filter((f) => !allowed.has(f));
    expect(violators, `CronService concrete import 누출: ${violators.join(", ")}`).toEqual([]);
  });
});

describe("PA-4 — application service는 concrete gateway/executor를 직접 import하지 않음", () => {
  const all_files = collect_ts_files(SRC);

  it("OrchestrationService에서 create_execution_gateway는 DI fallback으로만 사용", () => {
    const service_file = all_files.find(f => f.replaceAll(sep, "/").endsWith("orchestration/service.ts"))!;
    const content = readFileSync(service_file, "utf-8");
    const lines = content.split("\n");
    // import 라인과 DI fallback(??) 라인 제외 — 나머지에 직접 호출이 없어야 함
    const direct_calls = lines.filter(l =>
      l.includes("create_execution_gateway()") &&
      !l.includes("??") &&
      !l.trimStart().startsWith("import"),
    );
    expect(direct_calls, "create_execution_gateway() 직접 호출이 DI fallback 외에 존재").toEqual([]);
  });
});

describe("PA-3 — TeamStore concrete import는 route handler에서 제거됨", () => {
  const all_files = collect_ts_files(SRC);

  it("dashboard/routes/ 에서 TeamStore concrete import 없음 (type import만 허용)", () => {
    const route_files = all_files.filter(f => f.replaceAll(sep, "/").includes("dashboard/routes/"));
    const violators = find_concrete_imports(route_files, /import\s*\{[^}]*\bTeamStore\b/);
    expect(violators, `route handler에서 TeamStore concrete import: ${violators.join(", ")}`).toEqual([]);
  });

  it("dashboard/routes/ 에서 new TeamStore 직접 생성 없음", () => {
    const route_files = all_files.filter(f => f.replaceAll(sep, "/").includes("dashboard/routes/"));
    const violators: string[] = [];
    for (const file of route_files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("new TeamStore(")) {
        violators.push(relative(SRC, file).replaceAll(sep, "/"));
      }
    }
    expect(violators, `route handler에서 new TeamStore(): ${violators.join(", ")}`).toEqual([]);
  });
});

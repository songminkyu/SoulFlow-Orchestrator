/**
 * PA-7 Import Boundary — hexagonal 아키텍처의 의존성 방향을 정적 분석으로 검증.
 *
 * 규칙:
 * - inbound adapter (routes, channels)는 concrete outbound adapter를 직접 import 금지
 * - outbound adapter (providers/service, events/service)는 port interface를 co-export
 * - bootstrap만 concrete + port를 동시 import 허용
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "../../src");

/** 파일에서 static import 경로만 추출 (type import 제외). */
function extract_runtime_imports(file_path: string): string[] {
  const src = readFileSync(file_path, "utf-8");
  const imports: string[] = [];
  for (const m of src.matchAll(/^import\s+(?!type\b).*from\s+["']([^"']+)["']/gm)) {
    imports.push(m[1]);
  }
  return imports;
}

/** concrete outbound adapter 모듈 경로 패턴. */
const CONCRETE_OUTBOUND = [
  "../providers/cli.provider",
  "../providers/openrouter.provider",
  "../providers/orchestrator-llm.provider",
  "../../providers/cli.provider",
  "../../providers/openrouter.provider",
  "../../providers/orchestrator-llm.provider",
];

// ══════════════════════════════════════════════════════════════════
// inbound adapter → concrete outbound 직접 import 금지
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Import Boundary — inbound adapters", () => {
  const INBOUND_ROUTES = [
    "dashboard/routes/chat.ts",
    "dashboard/routes/state.ts",
    "dashboard/routes/health.ts",
    "dashboard/routes/webhook.ts",
  ];

  for (const route of INBOUND_ROUTES) {
    it(`${route}는 concrete outbound provider를 직접 import하지 않는다`, () => {
      const imports = extract_runtime_imports(join(SRC, route));
      for (const concrete of CONCRETE_OUTBOUND) {
        expect(imports, `${route} → ${concrete} 직접 import 감지`).not.toContain(concrete);
      }
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// outbound adapter → port interface co-export 검증
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Import Boundary — outbound port co-export", () => {
  const PORT_EXPORTS: [string, string][] = [
    ["providers/service.ts", "ProviderRegistryLike"],
    ["events/service.ts", "WorkflowEventServiceLike"],
    ["dashboard/broadcaster.ts", "SseBroadcasterLike"],
  ];

  for (const [file, port_name] of PORT_EXPORTS) {
    it(`${file}는 ${port_name} 포트 인터페이스를 export한다`, () => {
      const src = readFileSync(join(SRC, file), "utf-8");
      expect(src).toMatch(new RegExp(`export\\s+(type|interface)\\s+.*${port_name}`));
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// bootstrap만 concrete + port 동시 import 허용
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Import Boundary — bootstrap composition root", () => {
  it("bootstrap/orchestration.ts는 concrete와 port를 모두 import (허용)", () => {
    const imports = extract_runtime_imports(join(SRC, "bootstrap/orchestration.ts"));
    // bootstrap은 composition root이므로 concrete import 허용
    expect(imports.length).toBeGreaterThan(0);
  });
});

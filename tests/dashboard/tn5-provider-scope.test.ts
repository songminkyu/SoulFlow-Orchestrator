/**
 * TN-5 Scoped Provider Visibility 검증.
 *
 * 설계 완료 기준:
 *   - provider list와 실제 실행 권한이 같은 scope model을 따름
 *   - route/tool/workflow에서 동일 visibility 적용
 *
 * 공격자 관점:
 *   - team-alpha 사용자가 team-beta의 personal provider를 볼 수 있는가?
 *   - workflow suggest가 다른 팀의 provider를 자동 선택하는가?
 *   - prompt 실행이 다른 팀의 provider를 사용하는가?
 */

import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AgentProviderStore, type ProviderScopeFilter } from "@src/agent/provider-store.js";
import { ScopedProviderResolver } from "@src/auth/scoped-provider-resolver.js";
import { AdminStore } from "@src/auth/admin-store.js";
import { TeamStore } from "@src/auth/team-store.js";

// ── AgentProviderStore scope 필터 검증 ──

function make_provider_store(): AgentProviderStore {
  const db_path = join(tmpdir(), `tn5-ps-${randomUUID()}.db`);
  // SecretVault mock — get/set만 있으면 됨
  const vault = {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: () => [],
  };
  return new AgentProviderStore(db_path, vault as any);
}

describe("TN-5: AgentProviderStore — scope 필터 격리", () => {
  it("scope 없이 list() → 전체 반환 (superadmin)", () => {
    const store = make_provider_store();
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "g1", provider_type: "openai", label: "Global", scope_type: "global", scope_id: "" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "t1", provider_type: "anthropic", label: "Team A", scope_type: "team", scope_id: "team-a" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "p1", provider_type: "ollama", label: "Alice Personal", scope_type: "personal", scope_id: "alice" });

    expect(store.list()).toHaveLength(3);
  });

  it("team-a 사용자 → global + team-a + personal(alice)만 보임", () => {
    const store = make_provider_store();
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "g1", provider_type: "openai", label: "Global", scope_type: "global", scope_id: "" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "ta", provider_type: "anthropic", label: "Team A", scope_type: "team", scope_id: "team-a" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "tb", provider_type: "anthropic", label: "Team B", scope_type: "team", scope_id: "team-b" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "pa", provider_type: "ollama", label: "Alice", scope_type: "personal", scope_id: "alice" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "pb", provider_type: "ollama", label: "Bob", scope_type: "personal", scope_id: "bob" });

    const scope: ProviderScopeFilter = [
      { scope_type: "global", scope_id: "" },
      { scope_type: "team", scope_id: "team-a" },
      { scope_type: "personal", scope_id: "alice" },
    ];

    const visible = store.list(scope);
    expect(visible).toHaveLength(3);
    const ids = visible.map((p) => p.instance_id);
    expect(ids).toContain("g1");
    expect(ids).toContain("ta");
    expect(ids).toContain("pa");
    // team-b 프로바이더, bob의 personal 프로바이더는 안 보임
    expect(ids).not.toContain("tb");
    expect(ids).not.toContain("pb");
  });

  it("team-b 사용자 → team-a의 프로바이더 접근 불가", () => {
    const store = make_provider_store();
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "ta", provider_type: "anthropic", label: "Team A Only", scope_type: "team", scope_id: "team-a" });

    const scope_b: ProviderScopeFilter = [
      { scope_type: "global", scope_id: "" },
      { scope_type: "team", scope_id: "team-b" },
      { scope_type: "personal", scope_id: "bob" },
    ];

    expect(store.list(scope_b)).toHaveLength(0);
  });
});

// ── ScopedProviderResolver 크로스팀 격리 ──

describe("TN-5: ScopedProviderResolver — 크로스팀 격리", () => {
  it("team-a의 프로바이더는 team-b에서 보이지 않음", () => {
    const root = join(tmpdir(), `tn5-resolver-${randomUUID()}`);
    new TeamStore(join(root, "tenants", "team-a", "team.db"), "team-a")
      .create_provider({ name: "secret-model", type: "anthropic", model: "opus", config: {}, api_key_ref: "k", enabled: true });

    const admin = new AdminStore(join(root, "admin", "admin.db"));
    const resolver = new ScopedProviderResolver(admin, root);

    expect(resolver.list("team-a")).toHaveLength(1);
    expect(resolver.list("team-b")).toHaveLength(0);
  });

  it("find()로 다른 팀의 프로바이더 조회 불가", () => {
    const root = join(tmpdir(), `tn5-resolver-find-${randomUUID()}`);
    new TeamStore(join(root, "tenants", "team-a", "team.db"), "team-a")
      .create_provider({ name: "opus", type: "anthropic", model: "opus", config: {}, api_key_ref: "k", enabled: true });

    const resolver = new ScopedProviderResolver(new AdminStore(join(root, "admin", "admin.db")), root);

    expect(resolver.find("team-a", "opus", "anthropic")).not.toBeNull();
    expect(resolver.find("team-b", "opus", "anthropic")).toBeNull();
  });
});

// ── get_provider_summaries scope 관통 검증 ──

describe("TN-5: get_provider_summaries — scope 관통 검증", () => {
  it("scope 전달 시 provider_store.list(scope)가 호출됨을 시뮬레이션", () => {
    const store = make_provider_store();
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "g1", provider_type: "openai", label: "Global", scope_type: "global", scope_id: "" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "ta", provider_type: "anthropic", label: "Team A", scope_type: "team", scope_id: "team-a" });
    store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "pb", provider_type: "ollama", label: "Bob", scope_type: "personal", scope_id: "bob" });

    // bootstrap/workflow-ops.ts의 클로저와 동일 구조
    const get_provider_summaries = (scope?: ProviderScopeFilter) => {
      return store.list(scope).filter((p) => p.enabled).map((p) => ({
        backend: p.instance_id, label: p.label, provider_type: p.provider_type,
        models: [String((p.settings as Record<string, unknown>)?.model || "")].filter(Boolean),
      }));
    };

    // alice (team-a) scope
    const alice_scope: ProviderScopeFilter = [
      { scope_type: "global", scope_id: "" },
      { scope_type: "team", scope_id: "team-a" },
      { scope_type: "personal", scope_id: "alice" },
    ];

    const alice_visible = get_provider_summaries(alice_scope);
    expect(alice_visible).toHaveLength(2); // g1 + ta
    expect(alice_visible.map((p) => p.backend)).not.toContain("pb"); // bob의 personal 안 보임

    // undefined scope (superadmin) → 전체
    expect(get_provider_summaries()).toHaveLength(3);
  });
});

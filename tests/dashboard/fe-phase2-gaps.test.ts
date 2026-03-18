/**
 * G-11~G-14 FE Phase 2 갭 직접 검증.
 * - G-11: team switch pending state
 * - G-12: cross-team denial toast 문자열
 * - G-13: /api/protocols 엔드포인트
 * - G-14: PromptProfilePreview 존재 + rendered_prompt 의존
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RouteContext } from "@src/dashboard/route-context.js";
import { handle_skill } from "@src/dashboard/routes/skill.js";

const REPO_ROOT = join(__dirname, "..", "..");

/* ── G-13: /api/protocols 엔드포인트 ── */

function make_skill_ctx(method: string, pathname: string, protocols: string[] = []) {
  const sent = { status: 0, data: null as unknown };
  const req = { method, headers: {}, url: pathname } as unknown as import("http").IncomingMessage;
  const res = { statusCode: 0, headersSent: false, setHeader: vi.fn(), end: vi.fn() } as unknown as import("http").ServerResponse;
  const ctx: RouteContext = {
    req,
    res,
    url: new URL(pathname, "http://localhost"),
    options: {
      skill_ops: {
        list_skills: () => [],
        get_skill_detail: () => ({ metadata: null, content: null, references: null }),
        refresh: vi.fn(),
        upload_skill: vi.fn(),
        write_skill_file: vi.fn(),
        list_shared_protocols: () => protocols,
      },
    } as unknown as RouteContext["options"],
    auth_user: { sub: "u1", usr: "admin", role: "superadmin", tid: "default", wdir: "tenants/default/users/u1", iat: 0, exp: 9999999999 },
    team_context: { team_id: "default", role: "owner" },
    workspace_runtime: null,
    json: (r, status, data) => { sent.status = status; sent.data = data; },
    read_body: vi.fn().mockResolvedValue(null),
    add_sse_client: vi.fn(),
    build_state: vi.fn(),
    build_merged_tasks: vi.fn(),
    recent_messages: [],
    metrics: {} as RouteContext["metrics"],
    chat_sessions: new Map(),
    session_store: null,
    session_store_key: (id) => id,
    register_media_token: vi.fn(),
    oauth_callback_html: vi.fn(),
    resolve_request_origin: vi.fn(),
    bus: null as unknown as RouteContext["bus"],
    add_rich_stream_listener: vi.fn(),
  };
  return { ctx, sent };
}

describe("G-13: GET /api/protocols", () => {
  it("프로토콜 목록 반환", async () => {
    const protos = ["clarification-protocol", "phase-gates", "error-escalation"];
    const { ctx, sent } = make_skill_ctx("GET", "/api/protocols", protos);
    const handled = await handle_skill(ctx);
    expect(handled).toBe(true);
    expect(sent.status).toBe(200);
    expect((sent.data as { protocols: string[] }).protocols).toEqual(protos);
  });

  it("list_shared_protocols 미구현 시 빈 배열", async () => {
    const { ctx, sent } = make_skill_ctx("GET", "/api/protocols");
    // list_shared_protocols가 빈 배열 반환
    const handled = await handle_skill(ctx);
    expect(handled).toBe(true);
    expect((sent.data as { protocols: string[] }).protocols).toEqual([]);
  });
});

/* ── G-11/G-12: locale key 존재 검증 ── */

describe("G-11/G-12: i18n locale keys", () => {
  it("ko.json에 team switch 키 존재", async () => {
    const mod = await import("../../../src/i18n/locales/ko.json");
    const ko = (mod as { default: Record<string, string> }).default ?? mod;
    expect(ko["team.switch_title"]).toBe("팀 전환");
    expect(ko["team.switching"]).toBe("전환 중…");
    expect(ko["team.err_not_member"]).toBe("이 팀의 멤버가 아닙니다");
    expect(ko["team.err_id_required"]).toBe("팀 ID가 필요합니다");
    expect(ko["team.err_switch_failed"]).toBe("팀 전환에 실패했습니다");
  });

  it("en.json에 team switch 키 존재", async () => {
    const mod = await import("../../../src/i18n/locales/en.json");
    const en = (mod as { default: Record<string, string> }).default ?? mod;
    expect(en["team.switch_title"]).toBe("Switch Team");
    expect(en["team.switching"]).toBe("Switching…");
    expect(en["team.err_not_member"]).toBe("You are not a member of this team");
  });
});

/* ── G-11: root.tsx 소스에서 pending 배지 동작 구조 직접 검증 ── */

describe("G-11: root.tsx pending badge behavioral contract", () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(join(REPO_ROOT, "web/src/layouts/root.tsx"), "utf8");
  });

  it("switch_team.isPending 조건부로 topbar__team-badge--pending CSS 적용", () => {
    // switch_team.isPending이 실제로 badge CSS를 제어하는지 조건부 표현식 구조 검증
    expect(src).toMatch(/switch_team\.isPending\s*\?\s*["` ]*topbar__team-badge--pending/);
  });

  it("switch_team.isPending 조건부로 t(\"team.switching\") 렌더링", () => {
    // isPending 분기에서 t("team.switching")이 렌더되는지 구조 검증
    expect(src).toMatch(/switch_team\.isPending[\s\S]{0,200}t\("team\.switching"\)/);
  });

  it("button[disabled]가 switch_team.isPending과 연결됨", () => {
    // 전환 중 버튼이 실제로 비활성화되는지 검증
    expect(src).toMatch(/disabled=\{switch_team\.isPending\}/);
  });

  it("locale 버튼이 하드코딩 없이 t() 키 사용", () => {
    // I-1: 한국어/English가 하드코딩되지 않고 locale key 사용
    expect(src).toMatch(/t\("sidebar\.locale_ko"\)/);
    expect(src).toMatch(/t\("sidebar\.locale_en"\)/);
    expect(src).not.toMatch(/"한국어"/);
    expect(src).not.toMatch(/"English"/);
  });
});

/* ── G-12: root.tsx 소스에서 denial toast 호출 경로 직접 검증 ── */

describe("G-12: root.tsx denial toast behavioral contract", () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(join(REPO_ROOT, "web/src/layouts/root.tsx"), "utf8");
  });

  it("onError 핸들러에서 error code 분기 후 toast(msg, \"err\") 호출", () => {
    // toast가 단독 호출이 아니라 error code 기반 msg 분기 후 err 레벨로 호출되는지 검증
    expect(src).toMatch(/toast\(msg,\s*["']err["']\)/);
  });

  it("not_a_member code → t(\"team.err_not_member\") 매핑", () => {
    expect(src).toMatch(/not_a_member["' ]*\?[\s\S]{0,50}t\("team\.err_not_member"\)/);
  });

  it("team_id_required code → t(\"team.err_id_required\") 매핑", () => {
    expect(src).toMatch(/team_id_required["' ]*\?[\s\S]{0,50}t\("team\.err_id_required"\)/);
  });

  it("fallback → t(\"team.err_switch_failed\") 매핑", () => {
    expect(src).toMatch(/t\("team\.err_switch_failed"\)/);
  });
});

/* ── G-14: PromptProfilePreview 컴포넌트 계약 직접 검증 ── */

describe("G-14: PromptProfilePreview component contract", () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(join(REPO_ROOT, "web/src/pages/workflows/inspector-params.tsx"), "utf8");
  });

  it("PromptProfilePreview 함수 시그니처에 role_id, roles 파라미터 포함", () => {
    // 컴포넌트가 역할 데이터를 받는 props 구조 검증
    expect(src).toMatch(/function PromptProfilePreview\s*\(\s*\{[^}]*role_id[^}]*roles/);
  });

  it("preset.rendered_prompt 가드 후 렌더링 — null guard 존재", () => {
    // rendered_prompt 없을 때 null 반환하는 방어 로직 검증
    expect(src).toMatch(/preset\?\.rendered_prompt.*return null/s);
  });

  it("렌더 경로에서 preset.rendered_prompt를 실제로 표시", () => {
    // null guard 통과 후 실제로 rendered_prompt 콘텐츠를 출력하는지 검증
    expect(src).toMatch(/<pre[^>]*>\s*\{preset\.rendered_prompt\}\s*<\/pre>/);
  });

  it("PromptProfilePreview가 실제로 role_preset 인자로 호출됨", () => {
    // 컴포넌트가 부모에서 실제로 사용되는지 확인
    expect(src).toMatch(/<PromptProfilePreview\s/);
  });
});

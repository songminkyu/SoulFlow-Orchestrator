/**
 * IC-5: POST /api/chat/sessions/:id/canvas-action 라우트 소스-레벨 검증.
 * 라우트 핸들러의 구조를 소스에서 검증:
 * - canvas-action 경로 매칭 regex
 * - action_id 필수 검증
 * - bus.publish_inbound 호출 구조
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const chat_route = readFileSync(resolve(root, "src/dashboard/routes/chat.ts"), "utf-8");

describe("IC-5: canvas-action route 구조 검증", () => {
  it("canvas-action 경로 regex가 존재", () => {
    expect(chat_route).toContain("canvas-action");
    expect(chat_route).toMatch(/\/api\/chat\/sessions\/.*\/canvas-action/);
  });

  it("POST 메소드 검증", () => {
    expect(chat_route).toContain('req.method === "POST"');
  });

  it("action_id 필수 검증 로직", () => {
    expect(chat_route).toContain("action_id_required");
  });

  it("bus.publish_inbound 호출", () => {
    expect(chat_route).toContain("bus.publish_inbound");
    expect(chat_route).toContain("canvas_action: true");
  });

  it("응답 shape: { ok: true, action_id }", () => {
    expect(chat_route).toContain("{ ok: true, action_id }");
  });

  it("validate:skills npm script 존재", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
    expect(pkg.scripts["validate:skills"]).toBeDefined();
  });
});

/**
 * FE-2b: SessionBrowser i18n 키 사용 확인.
 * FE-0 발견: "Chat", "Mirror" 하드코딩 → i18n 키로 교체 검증.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/utils/format", () => ({
  time_ago: () => "1m ago",
}));

import { SessionBrowser } from "@/pages/chat/session-browser";
import type { ChatSessionSummary } from "@/pages/chat/types";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const sessions: ChatSessionSummary[] = [
  { id: "s1", created_at: "2026-01-01T00:00:00.000Z", message_count: 5, name: "Test Session" },
];

const mirror_sessions = [
  { key: "m1", provider: "slack", chat_id: "ch1", alias: "Mirror Chat", message_count: 3, updated_at: "2026-01-01T00:00:00.000Z" },
];

const base_props = {
  sessions,
  mirror_sessions,
  active_id: null as string | null,
  mirror_key: null as string | null,
  creating: false,
  onSelectSession: vi.fn(),
  onSelectMirror: vi.fn(),
  onNew: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
};

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("SessionBrowser i18n (FE-2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Chat 그룹 라벨이 i18n 키를 사용한다", () => {
    render(<SessionBrowser {...base_props} />);
    // i18n mock은 키 자체를 반환하므로 "session_browser.chat_group"이 표시
    expect(screen.getByText("session_browser.chat_group")).toBeInTheDocument();
  });

  it("Mirror 그룹 라벨이 i18n 키를 사용한다", () => {
    render(<SessionBrowser {...base_props} />);
    expect(screen.getByText("session_browser.mirror_group")).toBeInTheDocument();
  });

  it("하드코딩된 'Chat' 문자열이 존재하지 않는다", () => {
    render(<SessionBrowser {...base_props} />);
    // group-label에 하드코딩 "Chat"이 아닌 i18n 키 사용
    const group_labels = screen.getAllByText(/session_browser\./);
    expect(group_labels.length).toBeGreaterThanOrEqual(2);
  });

  it("하드코딩된 'Mirror' 문자열이 존재하지 않는다", () => {
    render(<SessionBrowser {...base_props} />);
    // "Mirror"라는 raw 텍스트는 없어야 함 (provider.toUpperCase()로 표시되는 "SLACK"은 별개)
    const labels = document.querySelectorAll(".session-browser__group-label");
    for (const label of labels) {
      expect(label.textContent).not.toBe("Chat");
      expect(label.textContent).not.toBe("Mirror");
    }
  });

  it("세션이 없으면 'no_sessions' 키 표시", () => {
    render(<SessionBrowser {...base_props} sessions={[]} mirror_sessions={[]} />);
    expect(screen.getByText("chat.no_sessions")).toBeInTheDocument();
  });

  it("세션 검색 placeholder가 i18n 키를 사용한다", () => {
    render(<SessionBrowser {...base_props} />);
    const search = screen.getByPlaceholderText("chat.session_search_placeholder");
    expect(search).toBeInTheDocument();
  });
});

/**
 * FE-5: MemoryTab — StatusView 적용 + RichResultRenderer 검색 프리뷰 검증.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// -- 모킹 --

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/i18n", () => ({
  useT: () => (key: string, p?: Record<string, string>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

vi.mock("@/api/client", () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn() } }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => (fn: () => Promise<void>) => fn(),
}));
vi.mock("@/utils/format", () => ({
  time_ago: (v: string) => v ? "1m ago" : "-",
}));

import { MemoryTab } from "@/pages/workspace/memory";

beforeEach(() => vi.clearAllMocks());

function setup_content(content: string | null, error?: boolean) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "state") {
      return { data: { decisions: [], promises: [], workflow_events: [] }, isLoading: false };
    }
    if (queryKey[0] === "memory-daily-list") {
      return { data: { days: [] }, isLoading: false };
    }
    if (queryKey[0] === "memory-content") {
      if (error) {
        return { data: undefined, isLoading: false, error: new Error("fetch fail"), refetch: vi.fn() };
      }
      return { data: content ? { content } : undefined, isLoading: false, error: null, refetch: vi.fn() };
    }
    return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
  });
}

// -- StatusView 래핑 --

describe("MemoryTab — StatusView 래핑 (FE-5)", () => {
  it("content_error 시 StatusView error 상태 표시", () => {
    setup_content(null, true);
    render(<MemoryTab />);
    // StatusView가 error 상태에서 status.error 메시지를 표시
    expect(screen.getByText("status.error")).toBeInTheDocument();
  });

  it("content 비어있으면 empty 상태 표시", () => {
    setup_content(null);
    render(<MemoryTab />);
    expect(screen.getByText("status.empty")).toBeInTheDocument();
  });

  it("content 있으면 RichResultRenderer로 렌더", () => {
    setup_content("Hello world content");
    render(<MemoryTab />);
    // RichResultRenderer는 text 모드로 content를 pre 내부에 렌더
    expect(screen.getByText("Hello world content")).toBeInTheDocument();
  });
});

// -- RichResultRenderer JSON 프리뷰 --

describe("MemoryTab — RichResultRenderer JSON 프리뷰 (FE-5)", () => {
  it("JSON 콘텐츠면 JSON 배지 표시", () => {
    setup_content('{"key": "value"}');
    render(<MemoryTab />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });
});

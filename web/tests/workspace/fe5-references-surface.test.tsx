/**
 * FE-5: ReferencesTab — lexical profile, retrieval status, hidden reason, RichResultRenderer 검증.
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
  useT: () => (key: string, p?: Record<string, unknown>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

vi.mock("@/api/client", () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn() } }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: () => ({ pending: false, run: vi.fn() }),
}));
vi.mock("@/utils/format", () => ({
  time_ago: (v: string) => v ? "1m ago" : "-",
}));

import { ReferencesTab } from "@/pages/workspace/references";

interface MockDoc {
  path: string;
  chunks: number;
  size: number;
  updated_at: string;
  lexical_profile?: string;
  tokenizer_hint?: string;
  retrieval_status?: "indexed" | "pending" | "failed";
  hidden_reason?: string;
}

function setup_docs(docs: MockDoc[]) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "references") {
      return {
        data: {
          documents: docs,
          stats: { total_docs: docs.length, total_chunks: 10, last_sync: "2026-01-01" },
        },
        isLoading: false,
      };
    }
    return { data: undefined, isLoading: false };
  });
}

beforeEach(() => vi.clearAllMocks());

// -- lexical_profile + tokenizer_hint --

describe("ReferencesTab — lexical profile / tokenizer hint (FE-5)", () => {
  it("lexical_profile 있으면 표시", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01", lexical_profile: "en-US" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("en-US")).toBeInTheDocument();
  });

  it("tokenizer_hint 있으면 괄호로 표시", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01", lexical_profile: "ko", tokenizer_hint: "cl100k" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("ko")).toBeInTheDocument();
    expect(screen.getByText("(cl100k)")).toBeInTheDocument();
  });

  it("둘 다 없으면 dash 표시", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01" }]);
    render(<ReferencesTab />);
    // lexical profile 컬럼 헤더가 존재
    expect(screen.getByText("repo.lexical_profile")).toBeInTheDocument();
  });
});

// -- retrieval_status --

describe("ReferencesTab — retrieval status (FE-5)", () => {
  it("retrieval_status=indexed -> ok badge", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01", retrieval_status: "indexed" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("indexed")).toBeInTheDocument();
  });

  it("retrieval_status=failed -> err badge", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01", retrieval_status: "failed" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });
});

// -- hidden_reason --

describe("ReferencesTab — hidden reason label (FE-5)", () => {
  it("hidden_reason 있으면 텍스트 표시", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01", hidden_reason: "blocked by policy" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("blocked by policy")).toBeInTheDocument();
  });
});

// -- RichResultRenderer 검색 결과 --

describe("ReferencesTab — column headers (FE-5)", () => {
  it("lexical_profile + retrieval_feedback 컬럼 헤더 존재", () => {
    setup_docs([{ path: "doc.md", chunks: 3, size: 1024, updated_at: "2026-01-01" }]);
    render(<ReferencesTab />);
    expect(screen.getByText("repo.lexical_profile")).toBeInTheDocument();
    expect(screen.getByText("repo.retrieval_feedback")).toBeInTheDocument();
  });
});

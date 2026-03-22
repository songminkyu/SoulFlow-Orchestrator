/** VR-6: AgentsTab smoke test — renders agent list. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
}));

vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => vi.fn(),
}));

vi.mock("@/hooks/use-table-filter", () => ({
  useTableFilter: () => ({ filter: "", setFilter: vi.fn(), filtered: [] }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuthStatus: () => ({ data: null }),
  useAuthUser: () => ({ data: null }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/send-agent-modal", () => ({
  SendAgentModal: () => null,
}));

import { AgentsTab } from "@/pages/workspace/agents";

describe("AgentsTab", () => {
  it("renders without crashing", () => {
    const { container } = render(<AgentsTab />);
    expect(container).toBeTruthy();
  });
});

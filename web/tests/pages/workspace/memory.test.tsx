/** VR-6: MemoryTab smoke test — renders memory view. */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuthStatus: () => ({ data: null }),
  useAuthUser: () => ({ data: null }),
}));

vi.mock("@/components/rich-result-renderer", () => ({
  RichResultRenderer: () => null,
}));

import { MemoryTab } from "@/pages/workspace/memory";

describe("MemoryTab", () => {
  it("renders without crashing", () => {
    const { container } = render(<MemoryTab />);
    expect(container).toBeTruthy();
  });
});

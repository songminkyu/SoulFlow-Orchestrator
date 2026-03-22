/** VR-6: ProvidersPage smoke test — renders provider list. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-resource-crud", () => ({
  useResourceCRUD: () => ({
    items: [],
    isLoading: false,
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    remove: { mutate: vi.fn() },
    queryClient: { invalidateQueries: vi.fn() },
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuthUser: () => ({ data: null }),
}));

vi.mock("@/hooks/use-team-providers", () => ({
  useScopedProviders: () => ({ data: [], isLoading: false }),
  useAddTeamProvider: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTeamProvider: () => ({ mutate: vi.fn() }),
  useAddGlobalProvider: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteGlobalProvider: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/pages/providers/provider-modal", () => ({
  ProviderModal: () => null,
}));

vi.mock("@/pages/providers/connection-modal", () => ({
  ConnectionModal: () => null,
}));

import ProvidersPage from "@/pages/providers/index";

describe("ProvidersPage", () => {
  it("renders without crashing", () => {
    render(<ProvidersPage />);
    // Tab bar should be present
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders tab labels", () => {
    render(<ProvidersPage />);
    expect(screen.getByText("providers.tab_providers")).toBeInTheDocument();
  });
});

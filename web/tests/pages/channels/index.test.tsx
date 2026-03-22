/** VR-6: ChannelsPage smoke test — renders channel list. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
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

vi.mock("@/hooks/use-toggle-mutation", () => ({
  useToggleMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/pages/channels/instance-modal", () => ({
  InstanceModal: () => null,
}));

vi.mock("@/pages/channels/global-settings", () => ({
  GlobalSettingsSection: () => null,
}));

import ChannelsPage from "@/pages/channels/index";

describe("ChannelsPage", () => {
  it("renders without crashing", () => {
    render(<ChannelsPage />);
    expect(screen.getByText("channels.title")).toBeInTheDocument();
  });

  it("renders add button", () => {
    render(<ChannelsPage />);
    const buttons = screen.getAllByText("channels.add");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});

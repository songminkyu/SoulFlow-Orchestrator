/** VR-6: SettingsPage smoke test — renders settings page with sections. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      raw: {},
      sections: [
        { id: "general", label: "General", fields: [{ path: "app.name", label: "Name", type: "string", value: "test", default_value: "", overridden: false, sensitive: false, sensitive_set: false, restart_required: false }] },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/surface-guard", () => ({
  SurfaceGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SettingsPage from "@/pages/settings";

describe("SettingsPage", () => {
  it("renders without crashing", () => {
    render(<SettingsPage />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
  });

  it("renders settings title", () => {
    render(<SettingsPage />);
    expect(screen.getByText("settings.title")).toBeInTheDocument();
  });

  it("renders section filter tabs", () => {
    render(<SettingsPage />);
    expect(screen.getByText("settings.all")).toBeInTheDocument();
  });
});

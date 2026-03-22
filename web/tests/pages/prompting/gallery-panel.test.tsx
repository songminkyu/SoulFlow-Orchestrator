/** VR-6: GalleryPanel smoke test — renders gallery grid. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

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

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/pages/prompting/agent-card", () => ({
  AgentCard: () => <div data-testid="agent-card" />,
}));

import { GalleryPanel } from "@/pages/prompting/gallery-panel";

describe("GalleryPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<GalleryPanel onGoToAgent={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

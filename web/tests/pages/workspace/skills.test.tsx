/** VR-6: SkillsTab smoke test — renders skills list. */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => vi.fn(),
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: () => ({ pending: false, run: vi.fn() }),
}));

import { SkillsTab } from "@/pages/workspace/skills";

describe("SkillsTab", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkillsTab />);
    expect(container).toBeTruthy();
  });
});

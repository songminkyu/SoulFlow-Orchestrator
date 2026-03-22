/** VR-6: LoginPage smoke test — login form renders, has username/password inputs. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { enabled: true, initialized: true }, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({ clear: vi.fn(), prefetchQuery: vi.fn() }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuthStatus: () => ({ data: { enabled: true, initialized: true }, isLoading: false }),
  useLogin: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en", set_locale: vi.fn() }),
  useT: () => (key: string) => key,
}));

import LoginPage from "@/pages/login";

describe("LoginPage", () => {
  it("renders without crashing", () => {
    const { container } = render(<LoginPage />);
    expect(container.querySelector(".login-page")).toBeInTheDocument();
  });

  it("renders username and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    const pwd = document.getElementById("login-password");
    expect(pwd).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<LoginPage />);
    expect(screen.getByText("login.submit")).toBeInTheDocument();
  });
});

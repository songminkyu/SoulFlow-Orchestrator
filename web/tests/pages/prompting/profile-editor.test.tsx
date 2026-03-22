/** VR-6: ProfileEditor smoke test — renders profile form fields. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/api/client", () => ({
  api: { post: vi.fn().mockResolvedValue({ text: "", sections: {} }) },
}));

import { ProfileEditor, type ProfileFormState } from "@/pages/prompting/profile-editor";

const base_form: ProfileFormState = {
  role_skill: "",
  soul: "",
  heart: "",
  shared_protocols: [],
  extra_instructions: "",
};

describe("ProfileEditor", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ProfileEditor form={base_form} available_protocols={[]} onChange={vi.fn()} />,
    );
    expect(container.querySelector(".pe-layout")).toBeInTheDocument();
  });

  it("renders role skill selector", () => {
    render(
      <ProfileEditor form={base_form} available_protocols={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("agents.section_role")).toBeInTheDocument();
  });

  it("renders soul textarea", () => {
    render(
      <ProfileEditor form={base_form} available_protocols={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("prompting.soul")).toBeInTheDocument();
  });
});

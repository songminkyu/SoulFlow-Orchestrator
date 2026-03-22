/** VR-6: DataTable smoke test — renders rows from data. */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DataTable } from "@/components/data-table";

describe("DataTable", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <DataTable>
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>Alice</td></tr></tbody>
      </DataTable>,
    );
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders rows from data", () => {
    const { container } = render(
      <DataTable>
        <tbody>
          <tr><td>Row 1</td></tr>
          <tr><td>Row 2</td></tr>
        </tbody>
      </DataTable>,
    );
    expect(container.querySelectorAll("tr")).toHaveLength(2);
  });

  it("applies small class when small=true", () => {
    const { container } = render(
      <DataTable small><tbody><tr><td>X</td></tr></tbody></DataTable>,
    );
    expect(container.querySelector(".data-table--xs")).toBeInTheDocument();
  });
});

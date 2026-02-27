import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ContactStatusBadge } from "./contact-status-badge";

describe("ContactStatusBadge", () => {
  afterEach(cleanup);

  test("renders 'Active' for active status", () => {
    render(<ContactStatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeDefined();
  });

  test("renders 'Inactive' for inactive status", () => {
    render(<ContactStatusBadge status="inactive" />);
    expect(screen.getByText("Inactive")).toBeDefined();
  });

  test("renders 'Lead' for lead status", () => {
    render(<ContactStatusBadge status="lead" />);
    expect(screen.getByText("Lead")).toBeDefined();
  });
});

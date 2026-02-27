import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { WorkflowStatusBadge } from "./workflow-status-badge";

describe("WorkflowStatusBadge", () => {
  afterEach(cleanup);

  test("renders 'Draft' label for draft status", () => {
    render(<WorkflowStatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeDefined();
  });

  test("renders 'Sent' label for sent status", () => {
    render(<WorkflowStatusBadge status="sent" />);
    expect(screen.getByText("Sent")).toBeDefined();
  });

  test("renders 'In Progress' for in_progress status", () => {
    render(<WorkflowStatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeDefined();
  });

  test("renders 'Awaiting Payment' for waiting_for_payment status", () => {
    render(<WorkflowStatusBadge status="waiting_for_payment" />);
    expect(screen.getByText("Awaiting Payment")).toBeDefined();
  });

  test("renders 'Completed' for completed status", () => {
    render(<WorkflowStatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeDefined();
  });

  test("renders 'Cancelled' for cancelled status", () => {
    render(<WorkflowStatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  test("renders 'Declined' for declined status", () => {
    render(<WorkflowStatusBadge status="declined" />);
    expect(screen.getByText("Declined")).toBeDefined();
  });

  test("defaults to 'Draft' when status is undefined", () => {
    render(<WorkflowStatusBadge status={undefined} />);
    expect(screen.getByText("Draft")).toBeDefined();
  });

  test("applies custom className prop", () => {
    render(<WorkflowStatusBadge status="draft" className="my-custom-class" />);
    const badge = screen.getByText("Draft");
    expect(badge.className).toContain("my-custom-class");
  });
});

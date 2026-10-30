import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SigningShell } from "./signing-shell";

describe("SigningShell", () => {
  it("renders header actions in embed mode (SEA-78 parity)", () => {
    render(
      <SigningShell
        embedded
        title="NDA"
        instruction="From sender@example.com"
        document={<div>PDF</div>}
        widget={<div>Widget</div>}
        headerActions={
          <button type="button" data-testid="signer-header-decline">
            Decline
          </button>
        }
      />
    );

    expect(screen.getByTestId("signer-header-decline")).toBeInTheDocument();
  });
});

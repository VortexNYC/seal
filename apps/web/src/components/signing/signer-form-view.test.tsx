import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignerFormView } from "./signer-form-view";

describe("SignerFormView", () => {
  it("lists fields and notifies on select", async () => {
    const user = userEvent.setup();
    const onSelectField = vi.fn();

    render(
      <SignerFormView
        fields={[
          {
            id: "f1",
            label: "Signature",
            fieldType: "signature",
            page: 1,
            isRequired: true,
            isFilled: false,
          },
          {
            id: "f2",
            label: "Full name",
            fieldType: "text",
            page: 1,
            isRequired: true,
            isFilled: true,
          },
        ]}
        activeFieldId={null}
        onSelectField={onSelectField}
      />
    );

    expect(screen.getByTestId("signer-form-view")).toBeInTheDocument();
    expect(screen.getByText(/required/i)).toBeInTheDocument();
    expect(screen.getByText(/done/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("signer-form-field-f1"));
    expect(onSelectField).toHaveBeenCalledWith("f1");
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { FIELD_TYPE_LABELS, FIELD_TYPES } from "@/lib/field-types";

import { FieldToolbar, PRIMARY_FIELD_TYPES } from "./field-toolbar";

afterEach(cleanup);

describe("FieldToolbar catalog (SEA-87)", () => {
  test("exposes every primary field type", () => {
    render(<FieldToolbar />);
    for (const type of PRIMARY_FIELD_TYPES) {
      expect(
        screen.getByTestId(`field-toolbar-${type}`)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${FIELD_TYPE_LABELS[type]}$`, "i"),
        })
      ).toBeEnabled();
    }
  });

  test("More fields exposes the rest of the Seal catalog", async () => {
    const user = userEvent.setup();
    render(<FieldToolbar />);

    await user.click(screen.getByRole("button", { name: /More fields/i }));

    const moreTypes = FIELD_TYPES.filter(
      (type) => !(PRIMARY_FIELD_TYPES as readonly string[]).includes(type)
    );
    expect(moreTypes.length).toBeGreaterThan(0);

    for (const type of moreTypes) {
      const button = screen.getByTestId(`field-toolbar-${type}`);
      expect(button).toBeInTheDocument();
      if (type === "payment") {
        expect(button).toBeDisabled();
      } else {
        expect(button).toBeEnabled();
      }
    }
  });

  test("PRIMARY + More equals the full FIELD_TYPES catalog", async () => {
    const user = userEvent.setup();
    render(<FieldToolbar />);
    await user.click(screen.getByRole("button", { name: /More fields/i }));

    for (const type of FIELD_TYPES) {
      expect(screen.getByTestId(`field-toolbar-${type}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^field-toolbar-/)).toHaveLength(
      FIELD_TYPES.length
    );
  });
});

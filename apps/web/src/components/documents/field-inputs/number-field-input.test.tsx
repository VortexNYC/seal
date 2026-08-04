import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NumberFieldInput } from "./number-field-input";

afterEach(cleanup);

function renderNumberField(
  overrides: Partial<Parameters<typeof NumberFieldInput>[0]> = {}
) {
  const onChange = vi.fn();
  const onValidationChange = vi.fn();

  const result = render(
    <NumberFieldInput
      label="Amount"
      isRequired={false}
      onChange={onChange}
      onValidationChange={onValidationChange}
      {...overrides}
    />
  );

  return { onChange, onValidationChange, ...result };
}

describe("NumberFieldInput", () => {
  test("renders label and input", () => {
    renderNumberField({ label: "Quantity" });
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
  });

  test("shows required indicator when isRequired", () => {
    renderNumberField({ label: "Price", isRequired: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("does not show required indicator when optional", () => {
    renderNumberField({ label: "Price", isRequired: false });
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  test("shows help text", () => {
    renderNumberField({ helpText: "Enter a number between 1 and 100" });
    expect(
      screen.getByText("Enter a number between 1 and 100")
    ).toBeInTheDocument();
  });

  test("calls onChange with typed value", async () => {
    const user = userEvent.setup();
    const { onChange } = renderNumberField();

    const input = screen.getByRole("spinbutton");
    await user.type(input, "42");

    expect(onChange).toHaveBeenCalledWith("4");
    expect(onChange).toHaveBeenCalledWith("42");
  });

  test("reports valid for optional empty field", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderNumberField({
      isRequired: false,
      value: "5",
    });

    const input = screen.getByRole("spinbutton");
    await user.clear(input);

    expect(onValidationChange).toHaveBeenCalledWith(true, undefined);
  });

  test("reports invalid for required empty field", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderNumberField({
      isRequired: true,
      value: "5",
    });

    const input = screen.getByRole("spinbutton");
    await user.clear(input);

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "This field is required"
    );
  });

  test("shows error when value is below min", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderNumberField({ min: 10 });

    const input = screen.getByRole("spinbutton");
    await user.type(input, "5");

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "Minimum value is 10"
    );
    expect(screen.getByText("Minimum value is 10")).toBeInTheDocument();
  });

  test("shows error when value is above max", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderNumberField({ max: 100 });

    const input = screen.getByRole("spinbutton");
    await user.type(input, "150");

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "Maximum value is 100"
    );
  });

  test("valid value within min/max range reports valid", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderNumberField({ min: 1, max: 100 });

    const input = screen.getByRole("spinbutton");
    await user.type(input, "50");

    const lastCall =
      onValidationChange.mock.calls[onValidationChange.mock.calls.length - 1];
    expect(lastCall).toEqual([true, undefined]);
  });

  test("hides help text when error is shown", async () => {
    const user = userEvent.setup();
    renderNumberField({ helpText: "Some help", isRequired: true, value: "5" });

    expect(screen.getByText("Some help")).toBeInTheDocument();

    const input = screen.getByRole("spinbutton");
    await user.clear(input);

    expect(screen.queryByText("Some help")).not.toBeInTheDocument();
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  test("renders with initial value", () => {
    renderNumberField({ value: "99" });
    expect(screen.getByRole("spinbutton")).toHaveValue(99);
  });

  test("renders with placeholder", () => {
    renderNumberField({ placeholder: "0.00" });
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
  });
});

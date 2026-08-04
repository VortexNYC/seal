import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { TextFieldInput } from "./text-field-input";

afterEach(cleanup);

function renderTextField(
  overrides: Partial<Parameters<typeof TextFieldInput>[0]> = {}
) {
  const onChange = vi.fn();
  const onValidationChange = vi.fn();

  const result = render(
    <TextFieldInput
      label="Name"
      isRequired={false}
      onChange={onChange}
      onValidationChange={onValidationChange}
      {...overrides}
    />
  );

  return { onChange, onValidationChange, ...result };
}

describe("TextFieldInput", () => {
  test("renders label and input", () => {
    renderTextField({ label: "Full Name" });
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  test("shows required indicator when isRequired", () => {
    renderTextField({ isRequired: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("calls onChange with typed value", async () => {
    const user = userEvent.setup();
    const { onChange } = renderTextField();

    const input = screen.getByRole("textbox");
    await user.type(input, "Jo");

    expect(onChange).toHaveBeenCalledWith("J");
    expect(onChange).toHaveBeenCalledWith("Jo");
  });

  test("reports invalid for required empty field", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderTextField({
      isRequired: true,
      value: "x",
    });

    const input = screen.getByRole("textbox");
    await user.clear(input);

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "This field is required"
    );
  });

  test("reports valid for optional empty field", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderTextField({
      isRequired: false,
      value: "x",
    });

    const input = screen.getByRole("textbox");
    await user.clear(input);

    expect(onValidationChange).toHaveBeenCalledWith(true, undefined);
  });

  test("validates minLength", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderTextField({ minLength: 3 });

    const input = screen.getByRole("textbox");
    await user.type(input, "ab");

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "Minimum length is 3 characters"
    );
  });

  test("shows character counter when maxLength is set", () => {
    renderTextField({ maxLength: 50, value: "hello" });
    expect(screen.getByText("5 / 50")).toBeInTheDocument();
  });

  test("validates pattern", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderTextField({ pattern: "^[A-Z]" });

    const input = screen.getByRole("textbox");
    await user.type(input, "lowercase");

    expect(onValidationChange).toHaveBeenCalledWith(
      false,
      "Value does not match required format"
    );
  });

  test("pattern passes for valid input", async () => {
    const user = userEvent.setup();
    const { onValidationChange } = renderTextField({ pattern: "^[A-Z]" });

    const input = screen.getByRole("textbox");
    await user.type(input, "Uppercase");

    const lastCall =
      onValidationChange.mock.calls[onValidationChange.mock.calls.length - 1];
    expect(lastCall).toEqual([true, undefined]);
  });

  test("renders textarea for long maxLength (> 100)", () => {
    renderTextField({ maxLength: 200 });
    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  test("renders input for short maxLength (<= 100)", () => {
    renderTextField({ maxLength: 50 });
    const input = screen.getByRole("textbox");
    expect(input.tagName).toBe("INPUT");
  });

  test("shows help text when no error", () => {
    renderTextField({ helpText: "Enter your full name" });
    expect(screen.getByText("Enter your full name")).toBeInTheDocument();
  });

  test("hides help text when error is shown", async () => {
    const user = userEvent.setup();
    renderTextField({
      helpText: "Enter your full name",
      isRequired: true,
      value: "x",
    });

    const input = screen.getByRole("textbox");
    await user.clear(input);

    expect(screen.queryByText("Enter your full name")).not.toBeInTheDocument();
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });
});

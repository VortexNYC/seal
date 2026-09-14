import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CheckboxFieldInput } from "./checkbox-field-input";

afterEach(cleanup);

function renderCheckboxField(
  overrides: Partial<Parameters<typeof CheckboxFieldInput>[0]> = {}
) {
  const onChange = vi.fn();
  const onValidationChange = vi.fn();

  const result = render(
    <CheckboxFieldInput
      label="Agree to terms"
      isRequired={false}
      onChange={onChange}
      onValidationChange={onValidationChange}
      {...overrides}
    />
  );

  return { onChange, onValidationChange, ...result };
}

describe("CheckboxFieldInput — single mode", () => {
  test("renders label", () => {
    renderCheckboxField({ label: "Accept conditions" });
    expect(screen.getByText("Accept conditions")).toBeInTheDocument();
  });

  test("shows required indicator when isRequired", () => {
    renderCheckboxField({ isRequired: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("calls onChange with 'true' when checked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCheckboxField({ value: "false" });

    await user.click(screen.getByRole("checkbox", { name: "Agree to terms" }));

    expect(onChange).toHaveBeenCalledWith("true");
  });

  test("calls onChange with 'false' when unchecked", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCheckboxField({ value: "true" });

    await user.click(screen.getByRole("checkbox", { name: "Agree to terms" }));

    expect(onChange).toHaveBeenCalledWith("false");
  });

  test("shows error for required unchecked field on initial render", () => {
    renderCheckboxField({ isRequired: true, value: "false" });
    expect(screen.getByText("This field must be checked")).toBeInTheDocument();
  });

  test("shows help text when there is no error", () => {
    renderCheckboxField({
      helpText: "You must agree to continue",
      value: "true",
    });
    expect(screen.getByText("You must agree to continue")).toBeInTheDocument();
  });

  test("hides help text when error is shown", () => {
    renderCheckboxField({
      helpText: "You must agree to continue",
      isRequired: true,
      value: "false",
    });
    expect(
      screen.queryByText("You must agree to continue")
    ).not.toBeInTheDocument();
    expect(screen.getByText("This field must be checked")).toBeInTheDocument();
  });
});

describe("CheckboxFieldInput — multi-option mode", () => {
  const options = ["Option A", "Option B", "Option C"];

  test("renders all option labels", () => {
    renderCheckboxField({ options });
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  test("calls onChange with JSON array when an option is toggled on", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCheckboxField({ options });

    await user.click(screen.getByRole("checkbox", { name: "Option A" }));

    expect(onChange).toHaveBeenCalledWith(JSON.stringify(["Option A"]));
  });

  test("calls onChange with JSON array reflecting deselection when an option is toggled off", async () => {
    const user = userEvent.setup();
    const { onChange } = renderCheckboxField({
      options,
      value: JSON.stringify(["Option A", "Option B"]),
    });

    await user.click(screen.getByRole("checkbox", { name: "Option A" }));

    expect(onChange).toHaveBeenCalledWith(JSON.stringify(["Option B"]));
  });

  test("shows required error on initial render when no options are selected", () => {
    renderCheckboxField({ options, isRequired: true });
    expect(
      screen.getByText("At least one option must be selected")
    ).toBeInTheDocument();
  });

  test("shows required indicator when isRequired", () => {
    renderCheckboxField({ options, isRequired: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("shows help text when there is no error", () => {
    renderCheckboxField({
      options,
      helpText: "Select all that apply",
      value: JSON.stringify(["Option A"]),
    });
    expect(screen.getByText("Select all that apply")).toBeInTheDocument();
  });

  test("hides help text when required error is shown", () => {
    renderCheckboxField({
      options,
      isRequired: true,
      helpText: "Select all that apply",
    });
    expect(screen.queryByText("Select all that apply")).not.toBeInTheDocument();
    expect(
      screen.getByText("At least one option must be selected")
    ).toBeInTheDocument();
  });
});

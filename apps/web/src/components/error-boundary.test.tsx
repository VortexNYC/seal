import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ErrorBoundary, ErrorFallback } from "./error-boundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Working</div>;
}

/**
 * Wrapper that holds shouldThrow in React state and exposes a button to clear it.
 * This allows the error boundary reset test to flip the throwing condition
 * without triggering a new component identity (which would re-throw on reset).
 */
function ControllableErrorBoundary() {
  const [shouldThrow, setShouldThrow] = useState(true);
  return (
    <>
      <button onClick={() => setShouldThrow(false)}>Stop Throwing</button>
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </>
  );
}

afterEach(cleanup);

describe("ErrorBoundary", () => {
  test("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Working")).toBeDefined();
  });

  test("shows fallback UI when child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeDefined();
    consoleSpy.mockRestore();
  });

  test("shows 'Something went wrong' heading in default fallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeDefined();
    consoleSpy.mockRestore();
  });

  test("shows custom fallback when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom fallback")).toBeDefined();
    expect(screen.queryByText("Something went wrong")).toBeNull();
    consoleSpy.mockRestore();
  });

  test("'Try Again' button resets error state and re-renders children", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<ControllableErrorBoundary />);

    // Initially the child throws, so the error fallback is shown
    expect(screen.getByText("Something went wrong")).toBeDefined();

    // First stop the child from throwing (via React state), then reset the boundary
    await user.click(screen.getByRole("button", { name: /stop throwing/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Working")).toBeDefined();
    consoleSpy.mockRestore();
  });
});

describe("ErrorFallback", () => {
  test("renders heading and both buttons", () => {
    render(<ErrorFallback error={null} onReset={() => {}} onGoHome={() => {}} />);

    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /go to home/i })).toBeDefined();
  });

  test("calls onReset when 'Try Again' clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<ErrorFallback error={null} onReset={onReset} onGoHome={() => {}} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(onReset).toHaveBeenCalledOnce();
  });

  test("calls onGoHome when 'Go to Home' clicked", async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();

    render(<ErrorFallback error={null} onReset={() => {}} onGoHome={onGoHome} />);

    await user.click(screen.getByRole("button", { name: /go to home/i }));

    expect(onGoHome).toHaveBeenCalledOnce();
  });
});

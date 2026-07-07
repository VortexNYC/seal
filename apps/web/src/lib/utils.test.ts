import { describe, test, expect } from "vitest";

import { cn, parseConvexError, getErrorMessage, clamp, truncateText } from "./utils";

describe("cn", () => {
  test("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("handles conditional classes", () => {
    const isHidden = false;
    expect(cn("base", isHidden && "hidden", "visible")).toBe("base visible");
  });

  test("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  test("handles empty arguments", () => {
    expect(cn()).toBe("");
  });

  test("resolves Tailwind conflicts with last-wins", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-white", "bg-black")).toBe("bg-black");
  });

  test("keeps non-conflicting Tailwind classes", () => {
    expect(cn("p-4", "m-2")).toBe("p-4 m-2");
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  test("handles array inputs via clsx", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  test("handles object inputs via clsx", () => {
    expect(cn({ hidden: true, visible: false })).toBe("hidden");
  });
});

describe("parseConvexError", () => {
  describe("permission errors", () => {
    test("detects 'not authorized' message", () => {
      const result = parseConvexError(new Error("User is not authorized"));
      expect(result.type).toBe("permission");
      expect(result.message).toBe("User is not authorized");
      expect(result.userFriendlyMessage).toContain("don't have permission");
    });

    test("detects 'permission' message", () => {
      const result = parseConvexError(new Error("Insufficient permission to edit"));
      expect(result.type).toBe("permission");
    });

    test("detects 'access denied' message", () => {
      const result = parseConvexError(new Error("Access denied for this resource"));
      expect(result.type).toBe("permission");
    });

    test("detects 'forbidden' message", () => {
      const result = parseConvexError(new Error("Forbidden"));
      expect(result.type).toBe("permission");
    });

    test("detects 'insufficient permissions' message", () => {
      const result = parseConvexError(new Error("Insufficient permissions"));
      expect(result.type).toBe("permission");
    });

    test("is case-insensitive", () => {
      const result = parseConvexError(new Error("ACCESS DENIED"));
      expect(result.type).toBe("permission");
    });
  });

  describe("subscription errors", () => {
    test("detects 'pro plan' message", () => {
      const result = parseConvexError(new Error("This feature requires a Professional plan"));
      expect(result.type).toBe("subscription");
      expect(result.userFriendlyMessage).toBe("This feature requires a Professional plan");
    });

    test("detects 'upgrade' message", () => {
      const result = parseConvexError(new Error("Please upgrade your plan"));
      expect(result.type).toBe("subscription");
    });

    test("detects 'subscription' message", () => {
      const result = parseConvexError(new Error("Active subscription required"));
      expect(result.type).toBe("subscription");
    });

    test("preserves original message as userFriendlyMessage", () => {
      const msg = "Upgrade to Professional to unlock this feature";
      const result = parseConvexError(new Error(msg));
      expect(result.userFriendlyMessage).toBe(msg);
    });
  });

  describe("not_found errors", () => {
    test("detects 'not found' message", () => {
      const result = parseConvexError(new Error("Document not found"));
      expect(result.type).toBe("not_found");
      expect(result.userFriendlyMessage).toContain("could not be found");
    });

    test("detects 'does not exist' message", () => {
      const result = parseConvexError(new Error("Resource does not exist"));
      expect(result.type).toBe("not_found");
    });
  });

  describe("validation errors", () => {
    test("detects 'invalid' message", () => {
      const result = parseConvexError(new Error("Invalid email address"));
      expect(result.type).toBe("validation");
      expect(result.userFriendlyMessage).toBe("Invalid email address");
    });

    test("detects 'required' message", () => {
      const result = parseConvexError(new Error("Name is required"));
      expect(result.type).toBe("validation");
    });

    test("detects 'must be' message", () => {
      const result = parseConvexError(new Error("Value must be a number"));
      expect(result.type).toBe("validation");
    });

    test("detects 'cannot be' message", () => {
      const result = parseConvexError(new Error("Field cannot be empty"));
      expect(result.type).toBe("validation");
    });

    test("preserves original message as userFriendlyMessage", () => {
      const msg = "Email is required";
      const result = parseConvexError(new Error(msg));
      expect(result.userFriendlyMessage).toBe(msg);
    });
  });

  describe("unknown errors", () => {
    test("returns unknown for unrecognized error messages", () => {
      const result = parseConvexError(new Error("Something broke"));
      expect(result.type).toBe("unknown");
      expect(result.message).toBe("Something broke");
      expect(result.userFriendlyMessage).toBe("Something broke");
    });

    test("falls back to default message when error message is empty", () => {
      const result = parseConvexError(new Error(""));
      expect(result.type).toBe("unknown");
      expect(result.userFriendlyMessage).toBe("An unexpected error occurred. Please try again.");
    });
  });

  describe("non-Error inputs", () => {
    test("handles string input", () => {
      const result = parseConvexError("not authorized to do this");
      expect(result.type).toBe("permission");
      expect(result.message).toBe("not authorized to do this");
    });

    test("handles ConvexError-like object with data string", () => {
      const convexLikeError = { data: "Document not found", message: "Document not found" };
      // parseConvexError uses String() for non-Error objects
      const result = parseConvexError(convexLikeError);
      expect(result.type).toBe("unknown");
    });

    test("handles number input", () => {
      const result = parseConvexError(404);
      expect(result.type).toBe("unknown");
      expect(result.message).toBe("404");
    });

    test("handles null input", () => {
      const result = parseConvexError(null);
      expect(result.type).toBe("unknown");
      expect(result.message).toBe("null");
    });

    test("handles undefined input", () => {
      const result = parseConvexError(undefined);
      expect(result.type).toBe("unknown");
      expect(result.message).toBe("undefined");
    });
  });

  describe("priority ordering", () => {
    test("permission takes precedence over not_found when both match", () => {
      // "not authorized" matches permission before "not found" check
      const result = parseConvexError(new Error("not authorized, resource not found"));
      expect(result.type).toBe("permission");
    });

    test("subscription takes precedence over validation", () => {
      // "upgrade" matches subscription before "required"
      const result = parseConvexError(new Error("Upgrade required for this feature"));
      expect(result.type).toBe("subscription");
    });
  });
});

describe("getErrorMessage", () => {
  test("returns permission-friendly message for permission errors", () => {
    const msg = getErrorMessage(new Error("Not authorized"));
    expect(msg).toContain("don't have permission");
  });

  test("returns original message for subscription errors", () => {
    const msg = getErrorMessage(new Error("Please upgrade your plan"));
    expect(msg).toBe("Please upgrade your plan");
  });

  test("returns not-found-friendly message", () => {
    const msg = getErrorMessage(new Error("Document not found"));
    expect(msg).toContain("could not be found");
  });

  test("returns original message for validation errors", () => {
    const msg = getErrorMessage(new Error("Email is required"));
    expect(msg).toBe("Email is required");
  });

  test("returns original message for unknown errors", () => {
    const msg = getErrorMessage(new Error("Unexpected failure"));
    expect(msg).toBe("Unexpected failure");
  });

  test("returns fallback for empty error", () => {
    const msg = getErrorMessage(new Error(""));
    expect(msg).toBe("An unexpected error occurred. Please try again.");
  });
});

describe("clamp", () => {
  describe("normal cases", () => {
    test("returns value when within bounds", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    test("returns min when value is below min", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    test("returns max when value is above max", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    test("returns min when value equals min", () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    test("returns max when value equals max", () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe("edge cases", () => {
    test("returns the shared value when min equals max", () => {
      expect(clamp(5, 3, 3)).toBe(3);
      expect(clamp(3, 3, 3)).toBe(3);
      expect(clamp(1, 3, 3)).toBe(3);
    });

    test("handles negative number ranges", () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });

    test("handles zero as a boundary", () => {
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(1, -10, 0)).toBe(0);
    });

    test("handles fractional values", () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(-0.1, 0, 1)).toBe(0);
      expect(clamp(1.1, 0, 1)).toBe(1);
    });
  });
});

describe("truncateText", () => {
  test("returns the original string when it fits within maxLen", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  test("truncates and adds ellipsis when string exceeds maxLen", () => {
    expect(truncateText("hello world", 5)).toBe("hello…");
  });

  test("returns empty string when input is empty", () => {
    expect(truncateText("", 5)).toBe("");
  });

  test("returns ellipsis when maxLen is 0 and string is non-empty", () => {
    expect(truncateText("hello", 0)).toBe("…");
  });

  test("handles exact boundary length", () => {
    expect(truncateText("hello", 5)).toBe("hello");
  });

  test("handles unicode characters", () => {
    expect(truncateText("日本語テキスト", 3)).toBe("日本語…");
  });
});

import { describe, test, expect } from "vitest";

import { cn, parseConvexError, getErrorMessage, slugify } from "./utils";

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
      const result = parseConvexError(new Error("This feature requires a Pro plan"));
      expect(result.type).toBe("subscription");
      expect(result.userFriendlyMessage).toBe("This feature requires a Pro plan");
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
      const msg = "Upgrade to Pro to unlock this feature";
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

describe("slugify", () => {
  test("converts a simple string to a slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("lowercases the output", () => {
    expect(slugify("FOO BAR BAZ")).toBe("foo-bar-baz");
  });

  test("removes special characters", () => {
    expect(slugify("Hello, World! How's it going?")).toBe("hello-world-hows-it-going");
  });

  test("handles leading and trailing spaces", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  test("collapses multiple consecutive spaces into a single hyphen", () => {
    expect(slugify("hello    world")).toBe("hello-world");
  });

  test("handles strings with hyphens already present", () => {
    expect(slugify("already-slugified")).toBe("already-slugified");
  });

  test("removes leading and trailing hyphens from special chars", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  test("handles unicode/accented characters", () => {
    expect(slugify("café résumé")).toBe("cafe-resume");
  });

  test("returns an empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  test("returns an empty string for whitespace-only input", () => {
    expect(slugify("   ")).toBe("");
  });

  test("handles numbers in strings", () => {
    expect(slugify("Version 2.0 Release")).toBe("version-20-release");
  });

  test("handles ampersands and pipes", () => {
    expect(slugify("Hello & Goodbye")).toBe("hello-and-goodbye");
  });
});

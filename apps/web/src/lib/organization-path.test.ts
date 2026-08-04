import { describe, test, expect } from "vitest";

import {
  buildOrganizationPath,
  isPathWithinOrganization,
} from "./organization-path";

describe("buildOrganizationPath", () => {
  describe("slug only (no target)", () => {
    test("returns just the slug path when target is undefined", () => {
      expect(buildOrganizationPath("acme")).toBe("/acme");
    });

    test("returns just the slug path when target is null", () => {
      expect(buildOrganizationPath("acme", null)).toBe("/acme");
    });

    test("returns just the slug path when target is empty string", () => {
      expect(buildOrganizationPath("acme", "")).toBe("/acme");
    });

    test("returns just the slug path when target is whitespace", () => {
      expect(buildOrganizationPath("acme", "   ")).toBe("/acme");
    });
  });

  describe("with known route segments", () => {
    test("builds path with a known segment", () => {
      expect(buildOrganizationPath("acme", "/documents")).toBe(
        "/acme/documents"
      );
    });

    test("builds path with another known segment", () => {
      expect(buildOrganizationPath("acme", "/settings")).toBe("/acme/settings");
    });

    test("builds path for each known segment", () => {
      const knownSegments = [
        "home",
        "documents",
        "templates",
        "contacts",
        "analytics",
        "payments",
        "accounts",
        "budgets",
        "categories",
        "goals",
        "transactions",
        "settings",
      ];

      for (const segment of knownSegments) {
        expect(buildOrganizationPath("acme", `/${segment}`)).toBe(
          `/acme/${segment}`
        );
      }
    });

    test("handles known segment without leading slash", () => {
      expect(buildOrganizationPath("acme", "documents")).toBe(
        "/acme/documents"
      );
    });
  });

  describe("with unknown paths", () => {
    test("falls back to slug-only path for unknown segment", () => {
      expect(buildOrganizationPath("acme", "/unknown-page")).toBe("/acme");
    });

    test("falls back to slug-only path for deeply nested unknown path", () => {
      expect(buildOrganizationPath("acme", "/foo/bar/baz")).toBe("/acme");
    });
  });

  describe("when target already contains the slug", () => {
    test("does not double the slug prefix", () => {
      expect(buildOrganizationPath("acme", "/acme/documents")).toBe(
        "/acme/documents"
      );
    });

    test("preserves slug-only path", () => {
      expect(buildOrganizationPath("acme", "/acme")).toBe("/acme");
    });

    test("preserves slug path with nested route", () => {
      expect(buildOrganizationPath("acme", "/acme/settings")).toBe(
        "/acme/settings"
      );
    });
  });

  describe("with a different slug as first segment followed by known segment", () => {
    test("replaces foreign slug and keeps known segment", () => {
      expect(buildOrganizationPath("acme", "/other-org/documents")).toBe(
        "/acme/documents"
      );
    });
  });

  describe("with query params", () => {
    test("preserves query string on known segment path", () => {
      expect(buildOrganizationPath("acme", "/documents?page=2")).toBe(
        "/acme/documents?page=2"
      );
    });

    test("preserves query string on slug-only fallback", () => {
      expect(buildOrganizationPath("acme", "/unknown?foo=bar")).toBe(
        "/acme?foo=bar"
      );
    });

    test("preserves complex query string", () => {
      expect(
        buildOrganizationPath("acme", "/documents?page=2&sort=date&dir=asc")
      ).toBe("/acme/documents?page=2&sort=date&dir=asc");
    });
  });

  describe("with hash", () => {
    test("preserves hash on known segment path", () => {
      expect(buildOrganizationPath("acme", "/settings#profile")).toBe(
        "/acme/settings#profile"
      );
    });

    test("preserves hash on slug-only fallback", () => {
      expect(buildOrganizationPath("acme", "/unknown#section")).toBe(
        "/acme#section"
      );
    });
  });

  describe("with both query params and hash", () => {
    test("preserves both query string and hash", () => {
      expect(buildOrganizationPath("acme", "/documents?page=1#results")).toBe(
        "/acme/documents?page=1#results"
      );
    });
  });

  describe("root path", () => {
    test("treats bare slash as empty and returns slug path", () => {
      expect(buildOrganizationPath("acme", "/")).toBe("/acme");
    });
  });
});

describe("isPathWithinOrganization", () => {
  describe("matching paths", () => {
    test("returns true for exact slug path", () => {
      expect(isPathWithinOrganization("acme", "/acme")).toBe(true);
    });

    test("returns true for slug path with sub-route", () => {
      expect(isPathWithinOrganization("acme", "/acme/documents")).toBe(true);
    });

    test("returns true for deeply nested path under slug", () => {
      expect(isPathWithinOrganization("acme", "/acme/settings/profile")).toBe(
        true
      );
    });
  });

  describe("non-matching paths", () => {
    test("returns false for a different slug", () => {
      expect(isPathWithinOrganization("acme", "/other-org/documents")).toBe(
        false
      );
    });

    test("returns false for root path", () => {
      expect(isPathWithinOrganization("acme", "/")).toBe(false);
    });

    test("returns false for path that starts with slug as prefix but is a different org", () => {
      expect(isPathWithinOrganization("acme", "/acme-corp/documents")).toBe(
        false
      );
    });
  });

  describe("edge cases", () => {
    test("returns false for undefined target", () => {
      expect(isPathWithinOrganization("acme")).toBe(false);
    });

    test("returns false for null target", () => {
      expect(isPathWithinOrganization("acme", null)).toBe(false);
    });

    test("returns false for empty string target", () => {
      expect(isPathWithinOrganization("acme", "")).toBe(false);
    });
  });
});

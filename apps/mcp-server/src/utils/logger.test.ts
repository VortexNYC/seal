import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createLogger } from "./logger";

describe("createLogger", () => {
  let originalConsoleError: typeof console.error;
  let loggedMessages: string[];

  beforeEach(() => {
    originalConsoleError = console.error;
    loggedMessages = [];
    console.error = mock((message: string) => {
      loggedMessages.push(message);
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("log levels", () => {
    test("logs messages at or above minLevel", () => {
      const logger = createLogger({ minLevel: "info" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(loggedMessages).toHaveLength(3);
      expect(loggedMessages[0]).toContain("info message");
      expect(loggedMessages[1]).toContain("warn message");
      expect(loggedMessages[2]).toContain("error message");
    });

    test("includes debug messages when minLevel is debug", () => {
      const logger = createLogger({ minLevel: "debug" });

      logger.debug("debug message");

      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain("debug message");
    });

    test("only logs errors when minLevel is error", () => {
      const logger = createLogger({ minLevel: "error" });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain("error");
    });
  });

  describe("silent mode", () => {
    test("logs nothing when silent is true", () => {
      const logger = createLogger({ silent: true });

      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(loggedMessages).toHaveLength(0);
    });
  });

  describe("formatting", () => {
    test("includes prefix in pretty format", () => {
      const logger = createLogger({ prefix: "[TestPrefix]", format: "pretty" });

      logger.info("test message");

      expect(loggedMessages[0]).toContain("[TestPrefix]");
      expect(loggedMessages[0]).toContain("test message");
    });

    test("outputs JSON when format is json", () => {
      const logger = createLogger({ format: "json" });

      logger.info("test message");

      expect(loggedMessages[0]).toBeDefined();
      const parsed = JSON.parse(loggedMessages[0] as string);
      expect(parsed.message).toBe("test message");
      expect(parsed.level).toBe("info");
      expect(parsed.timestamp).toBeDefined();
    });

    test("includes context in output", () => {
      const logger = createLogger({ format: "json" });

      logger.info("test message", { userId: "123", action: "login" });

      expect(loggedMessages[0]).toBeDefined();
      const parsed = JSON.parse(loggedMessages[0] as string);
      expect(parsed.context).toEqual({ userId: "123", action: "login" });
    });
  });

  describe("default options", () => {
    test("uses sensible defaults", () => {
      const logger = createLogger();

      logger.info("test");

      expect(loggedMessages).toHaveLength(1);
      expect(loggedMessages[0]).toContain("[Seal MCP]");
    });
  });
});

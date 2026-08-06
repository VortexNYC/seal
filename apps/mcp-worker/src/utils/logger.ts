/**
 * @fileoverview Structured logger for the Seal MCP server.
 * Provides consistent logging format across the codebase.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface LoggerOptions {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Output format: 'json' for machine-readable, 'pretty' for human-readable */
  format?: "json" | "pretty";
  /** Prefix for all log messages */
  prefix?: string;
  /** Disable all logging (useful for tests) */
  silent?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Creates a logger instance with the given options.
 */
export function createLogger(options: LoggerOptions = {}) {
  const {
    minLevel = "info",
    format = "pretty",
    prefix = "[Seal MCP]",
    silent = false,
  } = options;

  function shouldLog(level: LogLevel): boolean {
    if (silent) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
  }

  function formatMessage(entry: LogEntry): string {
    if (format === "json") {
      return JSON.stringify({
        ...entry,
        prefix,
      });
    }

    // Pretty format
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    return `${prefix} ${entry.message}${contextStr}`;
  }

  function log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formatted = formatMessage(entry);

    // Use stderr for MCP servers (stdout is for protocol messages)
    if (level === "error" || level === "warn") {
      console.error(formatted);
    } else {
      // For stdio mode, info/debug should also go to stderr
      // to avoid interfering with MCP protocol on stdout
      console.error(formatted);
    }
  }

  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      log("debug", message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      log("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      log("error", message, context),
  };
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  );
}

const envLogLevel = process.env.SEAL_LOG_LEVEL;

/**
 * Default logger instance.
 * Reads configuration from environment variables.
 */
export const logger = createLogger({
  minLevel: isLogLevel(envLogLevel) ? envLogLevel : "info",
  format: process.env.SEAL_LOG_FORMAT === "json" ? "json" : "pretty",
  silent: process.env.NODE_ENV === "test",
});

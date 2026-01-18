import pino from "pino";

// Note: pino-pretty transport uses worker threads which crash in Next.js 15
// with Turbopack/React Compiler. Use JSON logs and pipe through pino-pretty
// externally if needed: `pnpm dev 2>&1 | pnpm exec pino-pretty`
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

/**
 * Serialize an error for structured logging.
 * Extracts name, message, and stack (dev only) from Error objects.
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    };
  }
  return { message: String(error) };
}

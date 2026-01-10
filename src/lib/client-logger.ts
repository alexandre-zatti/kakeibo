const isDev = process.env.NODE_ENV === "development";

/**
 * Client-side logger for browser environments.
 * Logs debug/info only in development, warn/error always.
 */
export const clientLogger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => {
    if (isDev) {
      console.debug(`[DEBUG] ${msg}`, ctx);
    }
  },

  info: (msg: string, ctx?: Record<string, unknown>) => {
    if (isDev) {
      console.info(`[INFO] ${msg}`, ctx);
    }
  },

  warn: (msg: string, ctx?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`, ctx);
  },

  error: (msg: string, error?: unknown, ctx?: Record<string, unknown>) => {
    const errorCtx =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, ...ctx }
        : { error: String(error), ...ctx };
    console.error(`[ERROR] ${msg}`, errorCtx);
  },
};

/**
 * Set up global error handlers for uncaught errors and unhandled rejections.
 * Should be called once on app initialization.
 */
export function setupGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.onerror = (msg, src, line, col, err) => {
    clientLogger.error("Uncaught error", err, {
      message: String(msg),
      source: src,
      line,
      col,
    });
    return false;
  };

  window.onunhandledrejection = (event) => {
    clientLogger.error("Unhandled promise rejection", event.reason);
  };
}

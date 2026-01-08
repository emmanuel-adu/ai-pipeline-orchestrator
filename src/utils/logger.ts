/**
 * Generic logger interface
 * Compatible with popular loggers (pino, winston, console)
 */
export interface Logger {
  debug(obj: unknown, msg?: string): void
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

/**
 * Default console-based logger implementation
 * Simple fallback for when no logger is provided
 */
export const consoleLogger: Logger = {
  debug: (obj, msg) => {
    if (msg) {
      console.debug(msg, obj)
    } else {
      console.debug(obj)
    }
  },
  info: (obj, msg) => {
    if (msg) {
      console.info(msg, obj)
    } else {
      console.info(obj)
    }
  },
  warn: (obj, msg) => {
    if (msg) {
      console.warn(msg, obj)
    } else {
      console.warn(obj)
    }
  },
  error: (obj, msg) => {
    if (msg) {
      console.error(msg, obj)
    } else {
      console.error(obj)
    }
  },
}

/**
 * No-op logger for silent operation
 * Useful for testing or when logging is not desired
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

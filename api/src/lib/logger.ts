/**
 * Structured JSON Logger with Correlation ID (Node.js/Pino version)
 *
 * Logs all requests with correlation_id for end-to-end tracing
 * Format: JSON with timestamp, level, correlation_id, type, message, metadata
 */

import pino from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  correlation_id: string;
  request_id?: string;
  api_key_prefix?: string;
  type: string;
  message: string;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
}

// Base Pino logger instance
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
});

/**
 * Create a logger instance with correlation ID
 *
 * All logs will include the correlation_id for tracing
 *
 * @param correlationId - UUID for tracing request across services
 * @returns Logger object with debug, info, warn, error methods
 */
export function createLogger(correlationId: string) {
  const childLogger = baseLogger.child({ correlation_id: correlationId });

  const log = (
    level: LogLevel,
    type: string,
    message: string,
    metadata?: Record<string, unknown>
  ) => {
    const entry: LogEntry = {
      correlation_id: correlationId,
      type,
      message,
      ...(metadata && { metadata }),
    };

    childLogger[level](entry, message);
  };

  return {
    debug: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('debug', type, msg, meta),

    info: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('info', type, msg, meta),

    warn: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('warn', type, msg, meta),

    error: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('error', type, msg, meta),
  };
}

/**
 * Extract correlation ID from request headers or generate new one
 *
 * @param headers - Request headers object
 * @returns correlation_id string (existing or newly generated UUID)
 */
export function extractCorrelationId(headers: Record<string, string | undefined>): string {
  return headers['x-correlation-id'] || crypto.randomUUID();
}

export { baseLogger };

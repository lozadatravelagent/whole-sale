/**
 * Structured JSON Logger with Correlation ID
 *
 * Logs all requests with correlation_id for end-to-end tracing
 * Format: JSON with timestamp, level, correlation_id, type, message, metadata
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlation_id: string;
  request_id?: string;
  api_key_prefix?: string;
  type: string;
  message: string;
  latency_ms?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create a logger instance with correlation ID
 *
 * All logs will include the correlation_id for tracing
 *
 * @param correlationId - UUID for tracing request across services
 * @returns Logger object with debug, info, warn, error methods
 */
export function createLogger(correlationId: string) {
  const log = (
    level: LogLevel,
    type: string,
    message: string,
    metadata?: Record<string, unknown>
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlation_id: correlationId,
      type,
      message,
      ...(metadata && { metadata }),
    };
    console.log(JSON.stringify(entry));
  };

  return {
    debug: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('DEBUG', type, msg, meta),

    info: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('INFO', type, msg, meta),

    warn: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('WARN', type, msg, meta),

    error: (type: string, msg: string, meta?: Record<string, unknown>) =>
      log('ERROR', type, msg, meta),
  };
}

/**
 * Extract correlation ID from request headers or generate new one
 *
 * @param req - Request object
 * @returns correlation_id string (existing or newly generated UUID)
 */
export function extractCorrelationId(req: Request): string {
  return req.headers.get('X-Correlation-ID') || crypto.randomUUID();
}

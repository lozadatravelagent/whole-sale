/**
 * Session expiration configuration
 * 
 * Defines timeout values for automatic session expiration.
 * Sessions will expire after a period of inactivity.
 */

// Session timeout in milliseconds
// Default: 2 hours of inactivity
export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

// How often to check for session expiration (in milliseconds)
// Default: every 1 minute
export const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

// Grace period before showing warning (optional, for future use)
export const SESSION_WARNING_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// LocalStorage key for storing last activity timestamp
export const LAST_ACTIVITY_KEY = 'vibook_last_activity';

// Events that count as user activity
export const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'focus',
];


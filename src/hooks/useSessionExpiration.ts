import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  SESSION_TIMEOUT_MS,
  SESSION_CHECK_INTERVAL_MS,
  LAST_ACTIVITY_KEY,
  ACTIVITY_EVENTS,
} from '@/config/sessionConfig';

interface UseSessionExpirationOptions {
  /** Called when the session expires due to inactivity */
  onSessionExpired?: () => void;
  /** Whether session expiration tracking is enabled */
  enabled?: boolean;
}

/**
 * Hook that tracks user activity and triggers session expiration
 * after a period of inactivity.
 * 
 * This hook:
 * - Records the timestamp of the last user activity
 * - Periodically checks if the session has expired
 * - Calls onSessionExpired when inactivity timeout is reached
 * - Cleans up all tokens and localStorage data on expiration
 */
export function useSessionExpiration({
  onSessionExpired,
  enabled = true,
}: UseSessionExpirationOptions = {}) {
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isExpiredRef = useRef(false);

  // Update last activity timestamp in localStorage
  const updateLastActivity = useCallback(() => {
    if (!enabled || isExpiredRef.current) return;
    
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
  }, [enabled]);

  // Get last activity timestamp from localStorage
  const getLastActivity = useCallback((): number => {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (stored) {
      const timestamp = parseInt(stored, 10);
      if (!isNaN(timestamp)) {
        return timestamp;
      }
    }
    // If no stored value, initialize with current time
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    return now;
  }, []);

  // Check if session has expired
  const checkSessionExpiration = useCallback(async () => {
    if (!enabled || isExpiredRef.current) return;

    const lastActivity = getLastActivity();
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
      console.log('[SessionExpiration] Session expired due to inactivity');
      isExpiredRef.current = true;

      // Stop checking
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      // Perform logout
      await handleSessionExpired();
    }
  }, [enabled, getLastActivity]);

  // Handle session expiration: sign out and clean up
  const handleSessionExpired = useCallback(async () => {
    try {
      // Try to sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[SessionExpiration] Error during signOut:', error);
    }

    // Clean up localStorage (Supabase tokens)
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // Also remove our activity tracker
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error('[SessionExpiration] Error cleaning localStorage:', error);
    }

    // Call the callback if provided
    if (onSessionExpired) {
      onSessionExpired();
    }

    // Force redirect to login
    window.location.replace('/login?expired=true');
  }, [onSessionExpired]);

  // Throttled activity handler to avoid excessive localStorage writes
  const lastUpdateRef = useRef(0);
  const throttledUpdateActivity = useCallback(() => {
    const now = Date.now();
    // Only update if at least 10 seconds have passed since last update
    if (now - lastUpdateRef.current >= 10000) {
      lastUpdateRef.current = now;
      updateLastActivity();
    }
  }, [updateLastActivity]);

  // Set up activity listeners and expiration checking
  useEffect(() => {
    if (!enabled) return;

    // Initialize last activity timestamp
    updateLastActivity();

    // Add activity event listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Start periodic expiration check
    checkIntervalRef.current = setInterval(checkSessionExpiration, SESSION_CHECK_INTERVAL_MS);

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, throttledUpdateActivity);
      });

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [enabled, throttledUpdateActivity, updateLastActivity, checkSessionExpiration]);

  // Also check on page visibility change (user returns to tab)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab, check if session expired while away
        checkSessionExpiration();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkSessionExpiration]);

  return {
    /** Manually update last activity timestamp */
    updateLastActivity,
    /** Check if session has expired */
    checkSessionExpiration,
    /** Get the last activity timestamp */
    getLastActivity,
  };
}


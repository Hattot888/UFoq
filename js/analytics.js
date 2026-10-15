/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Dedicated Behavioral Analytics Engine
 *
 * Privacy-conscious, first-party telemetry tracking module.
 * Strictly controlled event types:
 * - site_visit
 * - page_view
 * - product_view
 * - add_to_cart
 * - sign_up
 * - login
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase, getCurrentUser, withTimeout } from './supabase.js';

// Controlled Event Types
export const EVENT_TYPES = Object.freeze({
  SITE_VISIT: 'site_visit',
  PAGE_VIEW: 'page_view',
  PRODUCT_VIEW: 'product_view',
  ADD_TO_CART: 'add_to_cart',
  SIGN_UP: 'sign_up',
  LOGIN: 'login'
});

const ALLOWED_EVENT_SET = new Set(Object.values(EVENT_TYPES));

// Storage Keys
const STORAGE_KEYS = {
  VISITOR_ID: 'horizon_visitor_id',
  SESSION_ID: 'horizon_session_id',
  SITE_VISIT_RECORDED: 'horizon_site_visit_recorded',
  CONSENT_CHOICE: 'horizon_analytics_consent'
};

// Guard against duplicate initialization within the same document lifecycle
let storefrontTrackingInitialized = false;

/**
 * Generates a standard RFC4122 v4 UUID
 * Uses crypto.randomUUID() where available, with cryptographically secure fallback
 * @returns {string}
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves or initializes the pseudonymous first-party visitor identifier.
 * Stored in localStorage. This is an approximation of a unique browser client.
 * @returns {string}
 */
export function getVisitorId() {
  try {
    let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 10) {
      visitorId = generateUUID();
      localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId);
    }
    return visitorId;
  } catch (err) {
    // If localStorage is blocked by privacy extensions or incognito mode
    return 'anon-ephemeral-' + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * Retrieves or initializes the current browsing session identifier.
 * Stored in sessionStorage; lasts until the browser tab/window is closed.
 * @returns {string}
 */
export function getSessionId() {
  try {
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      sessionId = generateUUID();
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    return sessionId;
  } catch (err) {
    return 'session-ephemeral-' + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * Checks if the user or browser has opted out of telemetry
 * @returns {boolean}
 */
export function isTrackingAllowed() {
  if (!CONFIG.ANALYTICS.ENABLED) return false;

  // Check user explicit consent if stored
  try {
    const consent = localStorage.getItem(STORAGE_KEYS.CONSENT_CHOICE);
    if (consent === 'declined') return false;
  } catch (e) {}

  // Check browser Do-Not-Track header if configured to respect it
  if (CONFIG.ANALYTICS.RESPECT_DO_NOT_TRACK && typeof navigator !== 'undefined') {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether the current page is an administrative area
 * to exclude admin internal browsing from public customer traffic
 * @returns {boolean}
 */
export function isAdminArea() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return path.includes('admin.html') || path.includes('/admin');
}

/**
 * Core event tracking function.
 * Asynchronously posts behavioral telemetry to Supabase.
 * Handles failures gracefully without interrupting store UX.
 *
 * @param {string} eventType - One of controlled EVENT_TYPES
 * @param {object} [options={}] - Additional details: productId, pagePath, metadata, userId
 * @returns {Promise<boolean>}
 */
export async function trackEvent(eventType, options = {}) {
  // Validate controlled event type
  if (!ALLOWED_EVENT_SET.has(eventType)) {
    console.warn(`[Analytics] Rejected unknown event type: "${eventType}"`);
    return false;
  }

  // Check tracking permissions
  if (!isTrackingAllowed()) {
    if (CONFIG.ANALYTICS.DEBUG_LOGS) {
      console.info(`[Analytics] Event "${eventType}" omitted (Do-Not-Track or opt-out).`);
    }
    return false;
  }

  // Exclude admin pages from public site visits and page views
  if (isAdminArea() && (eventType === EVENT_TYPES.SITE_VISIT || eventType === EVENT_TYPES.PAGE_VIEW)) {
    if (CONFIG.ANALYTICS.DEBUG_LOGS) {
      console.info(`[Analytics] Omitted ${eventType} from administrative area.`);
    }
    return false;
  }

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const pagePath = options.pagePath || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
  const productId = options.productId || null;

  // Ensure metadata never collects passwords, payment credentials, or unnecessary sensitive data
  const rawMetadata = options.metadata || {};
  const metadata = {};
  for (const [k, v] of Object.entries(rawMetadata)) {
    const lk = k.toLowerCase();
    if (!lk.includes('password') && !lk.includes('token') && !lk.includes('secret') && !lk.includes('card')) {
      metadata[k] = v;
    }
  }

  // Retrieve authenticated user ID if logged in
  let userId = options.userId || null;
  if (!userId) {
    try {
      const user = await getCurrentUser();
      if (user && user.id) {
        userId = user.id;
      }
    } catch (e) {
      // Ignore auth lookup errors in analytics
    }
  }

  const payload = {
    event_type: eventType,
    visitor_id: visitorId,
    session_id: sessionId,
    page_path: pagePath,
    product_id: productId,
    user_id: userId,
    metadata: metadata
  };

  if (CONFIG.ANALYTICS.DEBUG_LOGS) {
    console.groupCollapsed(`[Analytics 📊] Event: ${eventType} (${new Date().toLocaleTimeString()})`);
    console.log('Payload:', payload);
    console.groupEnd();
  }

  // If Supabase is not configured or offline, log warning and return gracefully
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  // Asynchronous non-blocking insert with timeout protection
  try {
    const insertPromise = supabase
      .from('analytics_events')
      .insert([payload]);

    const res = await withTimeout(insertPromise, 5000, { error: { message: 'Insert timed out' } });

    if (res && res.error) {
      console.warn('[Analytics] Failed to persist event to database:', res.error.message);
      return false;
    }
    return true;
  } catch (err) {
    // Never crash the application on analytics failure
    console.warn('[Analytics] Network exception during event tracking:', err?.message || err);
    return false;
  }
}

/**
 * Initializes automatic page-level tracking on public storefront pages:
 * 1. Checks if a site_visit should be recorded for this session.
 * 2. Records a page_view event for navigation.
 */
export function initStorefrontTracking() {
  if (typeof window === 'undefined' || isAdminArea()) return;
  if (storefrontTrackingInitialized) return;
  storefrontTrackingInitialized = true;

  // 1. Session-level Site Visit Tracking
  // Only records ONE site_visit per browsing session
  try {
    const hasRecordedVisit = sessionStorage.getItem(STORAGE_KEYS.SITE_VISIT_RECORDED);
    if (!hasRecordedVisit) {
      sessionStorage.setItem(STORAGE_KEYS.SITE_VISIT_RECORDED, 'true');
      trackEvent(EVENT_TYPES.SITE_VISIT, {
        metadata: {
          referrer: document.referrer || 'direct',
          screen_width: window.innerWidth,
          screen_height: window.innerHeight
        }
      });
    }
  } catch (e) {
    // Ignore storage restrictions
  }

  // 2. Page View Tracking
  trackEvent(EVENT_TYPES.PAGE_VIEW, {
    metadata: {
      title: document.title
    }
  });
}

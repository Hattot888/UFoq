/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Supabase Client Initialization & Authentication Helpers
 *
 * Robust ESM initialization with dual CDN fallback, timeouts,
 * and reliable session & admin status verification.
 */

import { CONFIG, isSupabaseConfigured } from './config.js';

let supabaseClient = null;
let clientError = null;

/**
 * Wraps a promise with a timeout to prevent async operations from hanging indefinitely.
 * @param {Promise} promise
 * @param {number} ms - Milliseconds to timeout
 * @param {*} fallbackValue - Value returned upon timeout
 * @returns {Promise}
 */
export function withTimeout(promise, ms = 7000, fallbackValue = null) {
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(fallbackValue);
    }, ms);
  });

  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutHandle);
      return res;
    }).catch((err) => {
      clearTimeout(timeoutHandle);
      throw err;
    }),
    timeoutPromise
  ]);
}

/**
 * Initializes the Supabase client instance using ESM CDN with automatic fallback
 */
async function initClient() {
  if (!isSupabaseConfigured()) {
    console.info('[Supabase] Running in local demo mode without database configuration.');
    return;
  }

  try {
    let createClient = null;

    // Try primary CDN (jsDelivr) with timeout
    try {
      const cdnPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const mod = await withTimeout(cdnPromise, 6000, null);
      if (mod && mod.createClient) {
        createClient = mod.createClient;
      }
    } catch (e) {
      console.warn('[Supabase] Primary CDN failed, attempting secondary CDN...', e.message);
    }

    // Try secondary CDN (esm.sh) if primary failed or timed out
    if (!createClient) {
      try {
        const fallbackPromise = import('https://esm.sh/@supabase/supabase-js@2');
        const mod = await withTimeout(fallbackPromise, 6000, null);
        if (mod && mod.createClient) {
          createClient = mod.createClient;
        }
      } catch (e2) {
        console.warn('[Supabase] Secondary CDN failed:', e2.message);
      }
    }

    if (!createClient) {
      throw new Error('تعذر تحميل مكتبة Supabase من خوادم CDN. يرجى التحقق من اتصال الإنترنت.');
    }

    // Initialize client singleton
    supabaseClient = createClient(CONFIG.SUPABASE_URL.trim(), CONFIG.SUPABASE_ANON_KEY.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'horizon_gallery_auth'
      }
    });

    console.info('✓ Supabase Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    clientError = err;
  }
}

// Await client initialization at module load
await initClient();

export const supabase = supabaseClient;
export const isConfigured = isSupabaseConfigured();
export const initError = clientError;

// Singleton in-memory cache and promise deduplication
let cachedUser = null;
let cachedUserId = null;
let cachedAdminStatus = null;
let userPromiseInFlight = null;
let adminPromiseInFlight = null;
let authListenerRegistered = false;

/**
 * Sets up a singleton Supabase Auth listener to handle session state changes
 * without creating duplicate subscriptions.
 */
function setupAuthListener() {
  if (!supabase || authListenerRegistered) return;
  authListenerRegistered = true;

  try {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const prevUserId = cachedUserId;
      const currentUserId = session?.user?.id || null;

      if (event === 'SIGNED_OUT' || !session) {
        cachedUser = null;
        cachedUserId = null;
        cachedAdminStatus = false;
        userPromiseInFlight = null;
        adminPromiseInFlight = null;
      } else if (currentUserId !== prevUserId || event === 'USER_UPDATED') {
        cachedUser = session.user;
        cachedUserId = currentUserId;
        cachedAdminStatus = null;
        userPromiseInFlight = null;
        adminPromiseInFlight = null;
      }

      // Notify application modules of the authentication state change
      window.dispatchEvent(new CustomEvent('horizon-auth-change', {
        detail: {
          event,
          session,
          user: session?.user || null
        }
      }));
    });
  } catch (err) {
    console.warn('Could not register Supabase auth state listener:', err);
  }
}

// Register singleton auth listener immediately if client is ready
setupAuthListener();

/**
 * Returns current authenticated user or null.
 * Deduplicates concurrent calls and checks local session first.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser(forceRefresh = false) {
  if (!supabase) return null;

  if (!forceRefresh && cachedUser && cachedUserId) {
    return cachedUser;
  }

  if (userPromiseInFlight) {
    return userPromiseInFlight;
  }

  userPromiseInFlight = (async () => {
    try {
      // 1. Check local session first
      const sessionPromise = supabase.auth.getSession();
      const sessionRes = await withTimeout(sessionPromise, 4000, null);

      if (!sessionRes || !sessionRes.data || !sessionRes.data.session) {
        cachedUser = null;
        cachedUserId = null;
        cachedAdminStatus = false;
        return null;
      }

      const sessionUser = sessionRes.data.session.user;
      if (!sessionUser) {
        cachedUser = null;
        cachedUserId = null;
        cachedAdminStatus = false;
        return null;
      }

      // 2. Validate session with server (with timeout)
      const userPromise = supabase.auth.getUser();
      const userRes = await withTimeout(userPromise, 5000, null);

      const resolvedUser = (userRes && userRes.data && userRes.data.user) ? userRes.data.user : sessionUser;
      cachedUser = resolvedUser;
      cachedUserId = resolvedUser ? resolvedUser.id : null;
      return resolvedUser;
    } catch (err) {
      console.warn('Could not retrieve current user:', err.message);
      return null;
    } finally {
      userPromiseInFlight = null;
    }
  })();

  return userPromiseInFlight;
}

/**
 * Checks if the current user is an authorized administrator.
 * Deduplicates in-flight promises and caches result for current user session.
 * Tries the public.is_admin() RPC function first (SECURITY DEFINER),
 * then falls back to directly querying public.admin_users table.
 *
 * Strictly accepts only 'admin' and 'super_admin' roles.
 * Never checks localStorage, sessionStorage, email names, URL params, or client flags.
 *
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<boolean>}
 */
export async function isCurrentUserAdmin(forceRefresh = false) {
  if (!supabase) return false;

  try {
    const user = await getCurrentUser(forceRefresh);
    if (!user || !user.id) {
      cachedAdminStatus = false;
      return false;
    }

    // Invalidate cache if user switched
    if (cachedUserId !== user.id) {
      cachedAdminStatus = null;
      cachedUserId = user.id;
    }

    // Return cached result if valid
    if (!forceRefresh && cachedAdminStatus !== null) {
      return cachedAdminStatus;
    }

    // Deduplicate in-flight checks
    if (!forceRefresh && adminPromiseInFlight) {
      return adminPromiseInFlight;
    }

    adminPromiseInFlight = (async () => {
      try {
        // 1. Try public.is_admin() RPC function (security definer)
        try {
          const rpcPromise = supabase.rpc('is_admin');
          const { data: rpcAdmin, error: rpcError } = await withTimeout(rpcPromise, 4000, { data: null, error: 'TIMEOUT' });
          if (!rpcError && typeof rpcAdmin === 'boolean') {
            cachedAdminStatus = rpcAdmin;
            return rpcAdmin;
          }
        } catch (e) {
          // Fall through to direct table check
        }

        // 2. Fallback: Query public.admin_users directly
        const queryPromise = supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        const result = await withTimeout(queryPromise, 5000, null);
        if (!result || result.error) {
          cachedAdminStatus = false;
          return false;
        }

        const data = result.data;
        const isAdmin = Boolean(data && (data.role === 'admin' || data.role === 'super_admin'));
        cachedAdminStatus = isAdmin;
        return isAdmin;
      } catch (err) {
        cachedAdminStatus = false;
        return false;
      } finally {
        adminPromiseInFlight = null;
      }
    })();

    return adminPromiseInFlight;
  } catch (err) {
    cachedAdminStatus = false;
    return false;
  }
}

/**
 * Explicitly invalidates the cached admin status and user session.
 */
export function invalidateAuthCache() {
  cachedUser = null;
  cachedUserId = null;
  cachedAdminStatus = null;
  userPromiseInFlight = null;
  adminPromiseInFlight = null;
}


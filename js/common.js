/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Common Utilities, UI Components, and Cart Management
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase, getCurrentUser, isCurrentUserAdmin } from './supabase.js';

// Storage Key for Shopping Cart
const CART_STORAGE_KEY = 'horizon_art_cart';

/**
 * Format currency amount with currency code
 * @param {number|string} amount
 * @param {string} [currency='EGP']
 * @returns {string}
 */
export function formatPrice(amount, currency = CONFIG.CURRENCY) {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const formatted = new Intl.NumberFormat(CONFIG.DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(numeric);

  return `${formatted} ${CONFIG.CURRENCY_SYMBOL}`;
}

/**
 * Sanitize and escape string for safe innerHTML injection
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Displays a non-blocking toast notification
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const iconSvg = type === 'success'
    ? '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>'
    : type === 'error'
    ? '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>'
    : '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button type="button" class="toast-close" aria-label="إغلاق">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// ------------------------------------------------------------------------------
// SHOPPING CART (Canonical representation: [{ id: UUID, quantity: number }])
// ------------------------------------------------------------------------------

/**
 * Gets canonical cart items from localStorage
 * @returns {Array<{ id: string, quantity: number }>}
 */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item.id === 'string' && item.quantity > 0);
    }
    return [];
  } catch (err) {
    console.error('Error reading cart from localStorage:', err);
    return [];
  }
}

/**
 * Saves canonical cart to localStorage and updates header counter
 * @param {Array<{ id: string, quantity: number }>} items
 */
export function saveCart(items) {
  try {
    const validItems = items.filter(i => i && typeof i.id === 'string' && i.quantity > 0);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validItems));
    updateCartBadge();
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: validItems } }));
  } catch (err) {
    console.error('Error saving cart to localStorage:', err);
  }
}

/**
 * Adds product to cart or increments quantity
 * @param {string} productId
 * @param {number} [quantity=1]
 * @returns {boolean}
 */
export function addToCart(productId, quantity = 1) {
  if (!productId) return false;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.id === productId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += qty;
  } else {
    cart.push({ id: productId, quantity: qty });
  }

  saveCart(cart);
  return true;
}

/**
 * Updates an item's quantity in the cart
 * @param {string} productId
 * @param {number} newQuantity
 */
export function updateCartItemQuantity(productId, newQuantity) {
  let cart = getCart();
  const qty = parseInt(newQuantity, 10);
  if (qty <= 0) {
    cart = cart.filter(item => item.id !== productId);
  } else {
    const item = cart.find(i => i.id === productId);
    if (item) {
      item.quantity = qty;
    }
  }
  saveCart(cart);
}

/**
 * Removes an item from the cart completely
 * @param {string} productId
 */
export function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
}

/**
 * Clears the shopping cart completely
 */
export function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  updateCartBadge();
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: [] } }));
}

/**
 * Calculates total item count in cart
 * @returns {number}
 */
export function getCartTotalCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

/**
 * Updates the cart badge element in the header across all pages
 */
export function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = getCartTotalCount();
  badges.forEach(badge => {
    badge.textContent = count > 0 ? count : '0';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
    badge.setAttribute('aria-label', `${count} عناصر في سلة التسوق`);
  });
}

// ------------------------------------------------------------------------------
// SHARED NAVIGATION & AUTH HEADER STATE
// ------------------------------------------------------------------------------

let authListenerAttached = false;

/**
 * Updates the visibility of Admin Dashboard links and tabs across the entire page.
 * Keeps links strictly hidden unless Supabase verifies that the user is an authorized admin.
 *
 * @param {boolean|null} [forcedIsAdmin=null]
 * @returns {Promise<boolean>}
 */
export async function updateAdminNavVisibility(forcedIsAdmin = null) {
  const adminElements = document.querySelectorAll('.admin-only-nav, [data-admin-only]');
  const adminLinks = document.querySelectorAll('a[href*="admin.html"]');

  const hideAll = () => {
    adminElements.forEach(el => {
      el.classList.remove('is-admin-verified');
      el.style.setProperty('display', 'none', 'important');
    });
    adminLinks.forEach(link => {
      if (link.getAttribute('href')?.includes('login.html?returnUrl=')) return;

      const parentLi = link.closest('li');
      if (parentLi) {
        parentLi.classList.remove('is-admin-verified');
        parentLi.style.setProperty('display', 'none', 'important');
      } else if (!link.closest('#admin-dashboard-container') && !link.closest('#admin-unauthorized-card')) {
        link.classList.remove('is-admin-verified');
        link.style.setProperty('display', 'none', 'important');
      }
    });
  };

  // If explicitly not admin or supabase not configured, hide immediately
  if (forcedIsAdmin === false || !isSupabaseConfigured() || !supabase) {
    hideAll();
    return false;
  }

  let isAdmin = false;
  if (typeof forcedIsAdmin === 'boolean') {
    isAdmin = forcedIsAdmin;
  } else {
    try {
      isAdmin = await isCurrentUserAdmin();
    } catch (err) {
      isAdmin = false;
    }
  }

  if (isAdmin) {
    adminElements.forEach(el => {
      el.classList.add('is-admin-verified');
      el.style.removeProperty('display');
    });
    adminLinks.forEach(link => {
      if (link.getAttribute('href')?.includes('login.html?returnUrl=')) return;

      const parentLi = link.closest('li');
      if (parentLi) {
        parentLi.classList.add('is-admin-verified');
        parentLi.style.removeProperty('display');
      } else if (!link.closest('#admin-dashboard-container') && !link.closest('#admin-unauthorized-card')) {
        link.classList.add('is-admin-verified');
        link.style.removeProperty('display');
      }
    });
  } else {
    hideAll();
  }

  return isAdmin;
}

/**
 * Synchronizes header authentication links (Login/Signup vs User Profile & Logout)
 * Only displays the Admin Dashboard link if user is confirmed as an administrator.
 */
export async function syncHeaderAuthState() {
  const authLinksContainer = document.getElementById('header-auth-links');
  if (!authLinksContainer) return;

  if (!isSupabaseConfigured() || !supabase) {
    authLinksContainer.innerHTML = `
      <a href="login.html" class="nav-link auth-nav-btn">تسجيل الدخول</a>
    `;
    updateAdminNavVisibility(false);
    return;
  }

  try {
    const user = await getCurrentUser();
    if (user) {
      // Check administrator authorization from database
      const isAdmin = await isCurrentUserAdmin();

      authLinksContainer.innerHTML = `
        <div class="user-menu-dropdown">
          <button type="button" class="nav-link user-btn" id="user-menu-btn" aria-haspopup="true" aria-expanded="false">
            <span class="user-avatar-circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span class="user-email-text">${escapeHtml(user.email ? user.email.split('@')[0] : 'المستخدم')}</span>
          </button>
          <div class="user-dropdown-content" id="user-dropdown">
            <div class="dropdown-header">
              <span class="dropdown-email">${escapeHtml(user.email || '')}</span>
              ${isAdmin ? '<span class="dropdown-role-badge">مسؤول المعرض</span>' : ''}
            </div>
            ${isAdmin ? '<a href="admin.html" class="dropdown-item">لوحة التحكم (الإدارة)</a>' : ''}
            <button type="button" class="dropdown-item text-danger" id="header-logout-btn">تسجيل الخروج</button>
          </div>
        </div>
      `;

      // Update remaining admin nav links on page
      updateAdminNavVisibility(isAdmin);

      // Setup dropdown toggle
      const userBtn = document.getElementById('user-menu-btn');
      const dropdown = document.getElementById('user-dropdown');
      if (userBtn && dropdown) {
        userBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = userBtn.getAttribute('aria-expanded') === 'true';
          userBtn.setAttribute('aria-expanded', !isExpanded);
          dropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
          userBtn.setAttribute('aria-expanded', 'false');
          dropdown.classList.remove('show');
        });
      }

      // Logout handler
      const logoutBtn = document.getElementById('header-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await supabase.auth.signOut();
            showToast('تم تسجيل الخروج بنجاح', 'info');
            // Instant navigation reset without requiring full page reload
            updateAdminNavVisibility(false);
            await syncHeaderAuthState();
          } catch (err) {
            console.error('Logout error:', err);
          }
        });
      }
    } else {
      authLinksContainer.innerHTML = `
        <a href="login.html" class="nav-link auth-nav-btn">تسجيل الدخول</a>
        <a href="signup.html" class="btn btn-sm btn-outline signup-nav-btn">إنشاء حساب</a>
      `;
      updateAdminNavVisibility(false);
    }
  } catch (err) {
    console.error('Error synchronizing auth state in header:', err);
    updateAdminNavVisibility(false);
  }
}

/**
 * Initializes the mobile navigation drawer toggling
 */
export function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const navMenu = document.getElementById('main-nav');
  const overlay = document.getElementById('mobile-nav-overlay');

  if (!toggleBtn || !navMenu) return;

  function toggleNav() {
    const isOpen = navMenu.classList.contains('is-open');
    if (isOpen) {
      navMenu.classList.remove('is-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (overlay) overlay.classList.remove('is-visible');
      document.body.style.overflow = '';
    } else {
      navMenu.classList.add('is-open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      if (overlay) overlay.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    }
  }

  toggleBtn.addEventListener('click', toggleNav);
  if (overlay) overlay.addEventListener('click', toggleNav);

  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
      toggleNav();
    }
  });
}

/**
 * Displays a non-intrusive banner if Supabase credentials have not been configured yet
 */
export function checkSupabaseStatusBanner() {
  if (isSupabaseConfigured()) return;

  const existing = document.getElementById('supabase-setup-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'supabase-setup-banner';
  banner.className = 'setup-notice-banner';
  banner.innerHTML = `
    <div class="banner-inner container">
      <span class="banner-icon">ℹ️</span>
      <span class="banner-text">
        <strong>وضع العرض التجريبي:</strong> لم يتم ربط Supabase بعد. لتفعيل تسجيل البيانات والتحليلات الحية، أضف بيانات مشروعك في <code>js/config.js</code>.
      </span>
      <button type="button" class="banner-close" aria-label="إغلاق التنبيه" onclick="this.closest('#supabase-setup-banner').remove()">&times;</button>
    </div>
  `;
  document.body.prepend(banner);
}

/**
 * Global initialization helper for all pages
 */
export function initCommonUI() {
  updateCartBadge();
  updateAdminNavVisibility(false); // Fail closed immediately on initialization
  syncHeaderAuthState();
  initMobileNav();
  checkSupabaseStatusBanner();

  if (!authListenerAttached) {
    authListenerAttached = true;
    window.addEventListener('horizon-auth-change', async (e) => {
      const { event, session } = e.detail || {};
      if (event === 'SIGNED_OUT' || !session) {
        updateAdminNavVisibility(false);
        await syncHeaderAuthState();
      } else {
        await syncHeaderAuthState();
      }
    });
  }

  // Listen for storage events (e.g. cart updated in another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === CART_STORAGE_KEY) {
      updateCartBadge();
    }
  });
}

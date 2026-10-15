/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Authentication Module (Supabase Auth Integration)
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase, getCurrentUser, invalidateAuthCache } from './supabase.js';
import { trackEvent, EVENT_TYPES } from './analytics.js';
import { showToast, escapeHtml, initCommonUI } from './common.js';

/**
 * Validates email format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Handles user account creation via Supabase Auth
 * Records `sign_up` analytics event only on verified success.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {Promise<{ success: boolean, message?: string, user?: object }>}
 */
export async function registerUser(email, password, fullName) {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      message: 'خدمة تسجيل الحسابات غير متصلة بقاعدة البيانات حالياً. يرجى إضافة بيانات Supabase في js/config.js.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim()
        }
      }
    });

    if (error) {
      return { success: false, message: translateAuthError(error.message) };
    }

    if (data && data.user) {
      // Record sign_up event only after successful creation
      await trackEvent(EVENT_TYPES.SIGN_UP, {
        metadata: {
          auth_provider: 'email',
          user_id: data.user.id
        }
      });

      return {
        success: true,
        user: data.user,
        message: data.session ? 'تم إنشاء الحساب وتسجيل الدخول بنجاح!' : 'تم إنشاء الحساب بنجاح! تفقد بريدك الإلكتروني لتأكيد الحساب.'
      };
    }

    return { success: false, message: 'تعذر إنشاء الحساب، يرجى المحاولة لاحقاً.' };
  } catch (err) {
    console.error('Registration exception:', err);
    return { success: false, message: 'حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.' };
  }
}

/**
 * Handles user login via Supabase Auth
 * Records `login` analytics event only on explicit interactive login success.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, message?: string, user?: object }>}
 */
export async function loginUser(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      message: 'خدمة تسجيل الدخول غير متصلة بقاعدة البيانات حالياً. يرجى ضبط Supabase في js/config.js.'
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      return { success: false, message: translateAuthError(error.message) };
    }

    if (data && data.user) {
      // Record explicit login event
      await trackEvent(EVENT_TYPES.LOGIN, {
        metadata: {
          auth_provider: 'email',
          user_id: data.user.id
        }
      });

      return {
        success: true,
        user: data.user,
        message: 'تم تسجيل الدخول بنجاح!'
      };
    }

    return { success: false, message: 'بيانات الدخول غير صحيحة.' };
  } catch (err) {
    console.error('Login exception:', err);
    return { success: false, message: 'حدث خطأ في الاتصال بالخادم أثناء تسجيل الدخول.' };
  }
}

/**
 * Handles user sign out
 */
export async function logoutUser() {
  invalidateAuthCache();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
  window.location.href = 'index.html';
}

/**
 * Translates common Supabase authentication errors to friendly Arabic messages
 * @param {string} message
 * @returns {string}
 */
function translateAuthError(message) {
  const msg = (message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return 'هذا البريد الإلكتروني مسجل بالفعل مسبقاً.';
  }
  if (msg.includes('password should be at least')) {
    return 'يجب ألا تقل كلمة المرور عن 6 أحرف.';
  }
  if (msg.includes('email not confirmed')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل إليك.';
  }
  if (msg.includes('rate limit')) {
    return 'تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار قليلاً والمحاولة لاحقاً.';
  }
  return message || 'حدث خطأ أثناء معالجة الطلب.';
}

/**
 * Wire Login Form on login.html
 */
export function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit-btn');
  const errorAlert = document.getElementById('auth-error-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = 'none';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      if (errorAlert) {
        errorAlert.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>جاري التحقق...</span>';

    const result = await loginUser(email, password);

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (result.success) {
      showToast(result.message, 'success');
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl') || 'index.html';
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 700);
    } else {
      if (errorAlert) {
        errorAlert.textContent = result.message;
        errorAlert.style.display = 'block';
      }
    }
  });
}

/**
 * Wire Signup Form on signup.html
 */
export function initSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const confirmPasswordInput = document.getElementById('signup-confirm-password');
  const submitBtn = document.getElementById('signup-submit-btn');
  const errorAlert = document.getElementById('auth-error-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = 'none';

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!name || !email || !password) {
      if (errorAlert) {
        errorAlert.textContent = 'يرجى ملء جميع الحقول المطلوبة.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (!isValidEmail(email)) {
      if (errorAlert) {
        errorAlert.textContent = 'يرجى إدخال بريد إلكتروني صحيح.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (password.length < 6) {
      if (errorAlert) {
        errorAlert.textContent = 'يجب ألا تقل كلمة المرور عن 6 أحرف أو أرقام.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    if (password !== confirmPassword) {
      if (errorAlert) {
        errorAlert.textContent = 'كلمتا المرور غير متطابقتين.';
        errorAlert.style.display = 'block';
      }
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>جاري إنشاء الحساب...</span>';

    const result = await registerUser(email, password, name);

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (result.success) {
      showToast(result.message, 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } else {
      if (errorAlert) {
        errorAlert.textContent = result.message;
        errorAlert.style.display = 'block';
      }
    }
  });
}

/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Shopping Cart Page Controller
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import {
  getCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  formatPrice,
  escapeHtml,
  initCommonUI,
  showToast
} from './common.js';
import { initStorefrontTracking } from './analytics.js';

let canonicalProductsMap = new Map();

/**
 * Loads trusted product details from Supabase or fallback catalog
 * to recalculate prices securely without trusting client storage.
 * @param {Array<string>} productIds
 */
async function fetchTrustedProducts(productIds) {
  canonicalProductsMap.clear();

  // Populate from fallback catalog first
  CONFIG.FALLBACK_CATALOG.forEach(p => {
    canonicalProductsMap.set(p.id, p);
  });

  if (isSupabaseConfigured() && supabase && productIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (!error && Array.isArray(data)) {
        data.forEach(p => {
          canonicalProductsMap.set(p.id, p);
        });
      }
    } catch (e) {
      console.warn('Could not refresh canonical cart prices from database:', e);
    }
  }
}

/**
 * Renders the shopping cart items and calculation breakdown
 */
async function renderCart() {
  const container = document.getElementById('cart-content-area');
  if (!container) return;

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="margin: var(--space-8) auto; max-width: 600px;">
        <div class="empty-state-icon">🛒</div>
        <h2 class="empty-state-title">سلة المقتنيات فارغة حالياً</h2>
        <p class="empty-state-desc">
          لم تقم بإضافة أي لوحة فنية بعد. استكشف مجموعتنا الفنية المعاصرة واختر ما يناسب ذائقتك ومساحتك.
        </p>
        <a href="index.html" class="btn btn-primary btn-lg">تصفح المعرض الآن &larr;</a>
      </div>
    `;
    return;
  }

  // Fetch trusted product records for canonical pricing
  const productIds = cart.map(i => i.id);
  await fetchTrustedProducts(productIds);

  let subtotal = 0;
  let hasUnavailableItems = false;

  const itemsHtml = cart.map(item => {
    const product = canonicalProductsMap.get(item.id);

    if (!product) {
      hasUnavailableItems = true;
      return `
        <tr>
          <td colspan="4">
            <div style="color: var(--color-error); font-size: var(--font-size-sm); display: flex; justify-content: space-between; align-items: center;">
              <span>عذراً، هذا العمل الفني (معرف: ${escapeHtml(item.id)}) لم يعد متوفراً في المعرض.</span>
              <button type="button" class="btn btn-sm btn-outline remove-item-btn" data-id="${escapeHtml(item.id)}">حذف من السلة</button>
            </div>
          </td>
        </tr>
      `;
    }

    const price = Number(product.price) || 0;
    const itemTotal = price * item.quantity;
    subtotal += itemTotal;
    const maxStock = Math.max(1, product.stock_quantity || 1);

    return `
      <tr data-product-id="${escapeHtml(product.id)}">
        <td>
          <div class="cart-item-info">
            <img
              src="${escapeHtml(product.image_url || '')}"
              alt="${escapeHtml(product.name)}"
              class="cart-item-thumb"
              onerror="this.style.display='none'"
            />
            <div>
              <div class="cart-item-title">
                <a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
              </div>
              <div class="cart-item-artist">الفنان: ${escapeHtml(product.artist)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(product.dimensions || '')}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight: 600;">${formatPrice(price, product.currency)}</span>
        </td>
        <td>
          <div class="quantity-stepper" style="display: inline-flex;">
            <button type="button" class="quantity-btn cart-qty-minus" data-id="${escapeHtml(product.id)}" aria-label="إنقاص">-</button>
            <input
              type="number"
              class="quantity-input"
              value="${item.quantity}"
              min="1"
              max="${maxStock}"
              readonly
              aria-label="الكمية"
            />
            <button type="button" class="quantity-btn cart-qty-plus" data-id="${escapeHtml(product.id)}" data-max="${maxStock}" aria-label="زيادة">+</button>
          </div>
        </td>
        <td>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-4);">
            <span style="font-weight: 700; color: var(--accent-primary);">${formatPrice(itemTotal, product.currency)}</span>
            <button
              type="button"
              class="btn-quick-add remove-item-btn"
              data-id="${escapeHtml(product.id)}"
              title="إزالة هذا العمل من السلة"
              aria-label="إزالة ${escapeHtml(product.name)}"
              style="color: var(--color-error); border-color: transparent;"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const shippingFee = 0; // Free insured shipping for fine arts
  const grandTotal = subtotal + shippingFee;

  container.innerHTML = `
    <div class="cart-layout">
      <!-- Items Table -->
      <div class="cart-items-wrapper">
        <div class="table-responsive">
          <table class="cart-table">
            <thead>
              <tr>
                <th scope="col" style="width: 45%;">العمل الفني</th>
                <th scope="col" style="width: 20%;">السعر الفردي</th>
                <th scope="col" style="width: 20%;">الكمية</th>
                <th scope="col" style="width: 15%;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
          <a href="index.html" class="btn btn-outline">&larr; مواصلة استكشاف المعرض</a>
          <button type="button" class="btn btn-outline text-danger" id="clear-cart-btn" style="color: var(--color-error); border-color: var(--color-error);">
            إفراغ السلة بالكامل
          </button>
        </div>
      </div>

      <!-- Summary Sidebar -->
      <aside class="cart-summary-box">
        <h2 class="cart-summary-title">ملخص الطلب</h2>

        <div class="summary-row">
          <span>المجموع الفرعي للأعمال:</span>
          <span>${formatPrice(subtotal)}</span>
        </div>

        <div class="summary-row">
          <span>الشحن والتأمين الفني:</span>
          <span style="color: var(--color-success); font-weight: 600;">مجاني (هدية المعرض)</span>
        </div>

        <div class="summary-row">
          <span>شهادات الأصالة والتوثيق:</span>
          <span style="color: var(--color-success); font-weight: 600;">مشمولة مجاناً</span>
        </div>

        <div class="summary-row total-row">
          <span>الإجمالي النهائي:</span>
          <span style="color: var(--accent-primary);">${formatPrice(grandTotal)}</span>
        </div>

        <div style="margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3);">
          <a href="checkout.html" class="btn btn-primary btn-block btn-lg" style="font-weight: 700;">
            متابعة إتمام الطلب &larr;
          </a>
          <p style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">
            تأكيد الطلب يتم عبر تجربة شراء آمنة وتوضيحية
          </p>
        </div>
      </aside>
    </div>
  `;

  // Attach event handlers
  container.querySelectorAll('.cart-qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = cart.find(i => i.id === id);
      if (item) {
        updateCartItemQuantity(id, item.quantity - 1);
        renderCart();
      }
    });
  });

  container.querySelectorAll('.cart-qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const maxStock = parseInt(btn.getAttribute('data-max'), 10) || 1;
      const item = cart.find(i => i.id === id);
      if (item) {
        if (item.quantity < maxStock) {
          updateCartItemQuantity(id, item.quantity + 1);
          renderCart();
        } else {
          showToast(`الحد الأقصى المتاح من هذا العمل هو ${maxStock} فقط`, 'warning');
        }
      }
    });
  });

  container.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      removeFromCart(id);
      showToast('تمت إزالة العمل الفني من السلة', 'info');
      renderCart();
    });
  });

  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    if (confirm('هل أنت متأكد من رغبتك في إفراغ سلة المقتنيات بالكامل؟')) {
      clearCart();
      showToast('تم إفراغ السلة بنجاح', 'info');
      renderCart();
    }
  });
}

// Initialization
function init() {
  initCommonUI();
  initStorefrontTracking();
  renderCart();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


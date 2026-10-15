/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Checkout Demonstration Flow
 *
 * NOTE: This is an explicit demonstration checkout flow.
 * No real financial transactions, card collection, or third-party payment gateways exist.
 * Demonstration orders are logged into the `demo_orders` table (clearly separated from analytics).
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import { getCart, clearCart, formatPrice, escapeHtml, initCommonUI, showToast, updateAdminNavVisibility } from './common.js';
import { initStorefrontTracking } from './analytics.js';

let cartItems = [];
let canonicalMap = new Map();

/**
 * Loads current cart items and prepares summary
 */
async function loadCheckoutSummary() {
  cartItems = getCart();
  const summaryContainer = document.getElementById('checkout-items-summary');
  const totalAmountEl = document.getElementById('checkout-total-amount');

  if (cartItems.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  // Populate canonical details
  CONFIG.FALLBACK_CATALOG.forEach(p => canonicalMap.set(p.id, p));

  if (isSupabaseConfigured() && supabase) {
    try {
      const ids = cartItems.map(i => i.id);
      const { data } = await supabase.from('products').select('*').in('id', ids);
      if (data) {
        data.forEach(p => canonicalMap.set(p.id, p));
      }
    } catch (e) {
      console.warn('Could not refresh prices for checkout:', e);
    }
  }

  let total = 0;
  if (summaryContainer) {
    summaryContainer.innerHTML = cartItems.map(item => {
      const p = canonicalMap.get(item.id) || { name: 'عمل فني', price: 0, image_url: '' };
      const itemPrice = (Number(p.price) || 0) * item.quantity;
      total += itemPrice;

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); font-size: var(--font-size-sm);">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" style="width: 44px; height: 36px; object-fit: cover; border-radius: var(--radius-sm); background: var(--bg-muted);" onerror="this.style.display='none'" />
            <div>
              <span style="font-weight: 600;">${escapeHtml(p.name)}</span>
              <span style="color: var(--text-muted); font-size: 0.75rem;"> × ${item.quantity}</span>
            </div>
          </div>
          <span style="font-weight: 600;">${formatPrice(itemPrice)}</span>
        </div>
      `;
    }).join('');
  }

  if (totalAmountEl) {
    totalAmountEl.textContent = formatPrice(total);
  }
}

/**
 * Handles demonstration form submission
 */
function initCheckoutForm() {
  const form = document.getElementById('demo-checkout-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('customer-name')?.value.trim();
    const phone = document.getElementById('customer-phone')?.value.trim();
    const address = document.getElementById('customer-address')?.value.trim();
    const city = document.getElementById('customer-city')?.value.trim();
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'demo_cod';
    const submitBtn = document.getElementById('place-order-btn');

    if (!name || !phone || !address || !city) {
      showToast('يرجى ملء جميع بيانات الشحن الإلزامية', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>جاري تسجيل الطلب التجريبي...</span>';

    // Calculate total
    let total = 0;
    const itemsData = cartItems.map(item => {
      const p = canonicalMap.get(item.id) || { name: 'لوحة فنية', price: 0 };
      const price = Number(p.price) || 0;
      total += price * item.quantity;
      return {
        product_id: item.id,
        name: p.name,
        quantity: item.quantity,
        unit_price: price,
        subtotal: price * item.quantity
      };
    });

    const orderPayload = {
      customer_name: name,
      customer_phone: phone,
      shipping_address: address,
      city: city,
      items: itemsData,
      total_amount: total,
      currency: CONFIG.CURRENCY,
      payment_method: paymentMethod,
      is_demo: true
    };

    let orderId = 'DEMO-' + Math.floor(100000 + Math.random() * 900000);

    // Save to demo_orders table in Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('demo_orders')
          .insert([orderPayload]);

        if (error) {
          console.warn('Could not record demo order in database:', error.message);
        }
      } catch (err) {
        console.warn('Could not record demo order in database:', err);
      }
    }

    // Clear cart after successful demonstration checkout
    clearCart();

    // Render Success Confirmation Screen
    renderOrderConfirmation(orderId, orderPayload);
  });
}

/**
 * Renders the order confirmation message
 */
function renderOrderConfirmation(orderId, orderData) {
  const container = document.getElementById('checkout-container');
  if (!container) return;

  container.innerHTML = `
    <div style="background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--space-8); max-width: 680px; margin: var(--space-8) auto; box-shadow: var(--shadow-card); text-align: center;">
      <div style="width: 64px; height: 64px; border-radius: var(--radius-full); background-color: var(--color-success-bg); color: var(--color-success); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: var(--space-4);">
        ✓
      </div>

      <div class="demo-badge-bar" style="margin-bottom: var(--space-4); justify-content: center;">
        <span>ℹ️ تم تسجيل هذا الطلب كـ <strong>طلب تجريبي توضيحي (Test Order)</strong> ولم يتم خصم أو تحصيل أي أموال.</span>
      </div>

      <h1 style="font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: var(--space-2);">شكراً لك! تم استلام طلبك التجريبي بنجاح</h1>
      <p style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-6);">
        رقم الطلب المرجعي: <code style="font-weight: 700; color: var(--text-primary); font-size: var(--font-size-base);">${escapeHtml(orderId)}</code>
      </p>

      <div style="background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: var(--space-4); text-align: right; margin-bottom: var(--space-6);">
        <h3 style="font-size: var(--font-size-sm); font-weight: 700; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-2);">تفاصيل الشحن التوضيحية:</h3>
        <p style="font-size: var(--font-size-xs); margin-bottom: var(--space-1);"><strong>اسم العميل:</strong> ${escapeHtml(orderData.customer_name)}</p>
        <p style="font-size: var(--font-size-xs); margin-bottom: var(--space-1);"><strong>رقم الهاتف:</strong> ${escapeHtml(orderData.customer_phone)}</p>
        <p style="font-size: var(--font-size-xs); margin-bottom: var(--space-1);"><strong>عنوان التسليم:</strong> ${escapeHtml(orderData.shipping_address)}، ${escapeHtml(orderData.city)}</p>
        <p style="font-size: var(--font-size-xs); margin-bottom: var(--space-1);"><strong>طريقة الدفع المختارة:</strong> ${orderData.payment_method === 'demo_cod' ? 'تجريبي: دفع عند الاستلام' : 'تجريبي: تحويل بنكي'}</p>
        <p style="font-size: var(--font-size-sm); font-weight: 700; margin-top: var(--space-3); color: var(--accent-primary);"><strong>إجمالي قيمة المقتنيات:</strong> ${formatPrice(orderData.total_amount)}</p>
      </div>

      <div style="display: flex; gap: var(--space-4); justify-content: center; flex-wrap: wrap;">
        <a href="index.html" class="btn btn-primary">العودة إلى المعرض الرئيسي</a>
        <a href="admin.html" class="btn btn-outline admin-only-nav" style="display: none;">لوحة تحكم الإدارة (لمراجعة التحليلات) &larr;</a>
      </div>
    </div>
  `;
  updateAdminNavVisibility();
}

// Initialization
function init() {
  initCommonUI();
  initStorefrontTracking();
  loadCheckoutSummary();
  initCheckoutForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


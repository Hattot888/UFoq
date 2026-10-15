/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Product Details Controller
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import { formatPrice, escapeHtml, addToCart, showToast, initCommonUI } from './common.js';
import { trackEvent, EVENT_TYPES, initStorefrontTracking } from './analytics.js';

let currentProduct = null;
let currentQuantity = 1;

const ART_FALLBACK_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23EFEBE3'/%3E%3Cpath d='M250 400 L350 280 L440 370 L520 240 L640 400 Z' fill='%23D5CEC3'/%3E%3Ccircle cx='320' cy='200' r='45' fill='%23D5CEC3'/%3E%3Ctext x='50%25' y='80%25' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%2377736D'%3E%D8%A5%D8%B7%D8%A7%D8%B1 %D8%B9%D9%85%D9%84 %D9%81%D9%86%D9%8A%3C/text%3E%3C/svg%3E`;

/**
 * Extracts and validates product UUID from URL query string
 * @returns {string|null}
 */
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id || id.trim() === '') return null;
  return id.trim();
}

/**
 * Loads product details from Supabase or fallback catalog
 * @param {string} productId
 */
async function loadProductDetails(productId) {
  const container = document.getElementById('product-details-container');
  if (!container) return;

  let product = null;

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Supabase query error:', error.message);
      }
      product = data;
    } catch (e) {
      console.warn('Network exception fetching product:', e);
    }
  }

  // If not found in database or unconfigured, check fallback catalog
  if (!product) {
    product = CONFIG.FALLBACK_CATALOG.find(p => p.id === productId);
  }

  if (!product) {
    renderNotFoundState();
    return;
  }

  currentProduct = product;
  renderProductView(product);
  loadRelatedProducts(product);

  // Record product_view event
  await trackEvent(EVENT_TYPES.PRODUCT_VIEW, {
    productId: product.id,
    metadata: {
      product_name: product.name,
      category: product.category,
      price: product.price
    }
  });
}

/**
 * Renders the product details view
 * @param {object} product
 */
function renderProductView(product) {
  const container = document.getElementById('product-details-container');
  if (!container) return;

  document.title = `${product.name} | ${CONFIG.STORE_NAME}`;

  const isOutOfStock = product.stock_quantity <= 0;
  const maxStock = Math.max(1, product.stock_quantity || 1);

  container.innerHTML = `
    <!-- Breadcrumbs -->
    <nav class="breadcrumbs" aria-label="مسار التنقل">
      <a href="index.html">الرئيسية</a>
      <span class="breadcrumb-separator">/</span>
      <a href="index.html?category=${encodeURIComponent(product.category || 'all')}">${escapeHtml(product.category || 'الأعمال')}</a>
      <span class="breadcrumb-separator">/</span>
      <span aria-current="page">${escapeHtml(product.name)}</span>
    </nav>

    <div class="product-details-grid">
      <!-- Artwork Gallery Visual -->
      <div class="product-gallery">
        <div class="product-main-image-frame">
          <img
            src="${escapeHtml(product.image_url || ART_FALLBACK_IMG)}"
            alt="${escapeHtml(product.name)} - إبداع الفنان ${escapeHtml(product.artist)}"
            class="product-main-image"
            id="main-artwork-img"
            onerror="this.onerror=null; this.src='${ART_FALLBACK_IMG}';"
          />
        </div>
      </div>

      <!-- Artwork Details & Purchasing -->
      <div class="product-info-panel">
        <span class="product-category-tag">${escapeHtml(product.category || 'عمل تشكيلي')}</span>
        <h1 class="product-title-heading">${escapeHtml(product.name)}</h1>
        <p class="product-artist-name">بريشة الفنان: <strong>${escapeHtml(product.artist || 'فنان معاصر')}</strong></p>

        <div class="product-price-block">
          <span class="product-price-amount">${formatPrice(product.price, product.currency)}</span>
          <span class="product-tax-note">شامل ضريبة القيمة المضافة وشهادة التوثيق الأصلية</span>
        </div>

        <div class="product-description-text">
          <p>${escapeHtml(product.description || 'عمل فني أصلي متقن يعكس مهارة وإحساس الفنان.')}</p>
        </div>

        <!-- Specifications Table -->
        <table class="specs-table" aria-label="مواصفات العمل الفني">
          <tbody>
            <tr>
              <th scope="row">الأبعاد والمقاس</th>
              <td>${escapeHtml(product.dimensions || 'غير محدد')}</td>
            </tr>
            <tr>
              <th scope="row">الخامات والتقنية</th>
              <td>${escapeHtml(product.medium || 'ألوان زيتية وأكريليك')}</td>
            </tr>
            <tr>
              <th scope="row">حالة التوفر</th>
              <td>
                ${isOutOfStock
                  ? '<span class="text-danger" style="font-weight: 700;">نفدت الكمية الحالية</span>'
                  : `<span class="text-success">متوفر (${product.stock_quantity} قطعة فقط متوفرة)</span>`}
              </td>
            </tr>
            <tr>
              <th scope="row">الرقم المرجعي (UUID)</th>
              <td><code style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(product.id)}</code></td>
            </tr>
          </tbody>
        </table>

        <!-- Purchase Controls -->
        <div class="purchase-controls">
          ${isOutOfStock ? `
            <button type="button" class="btn btn-secondary btn-lg" disabled style="flex: 1;">
              نفدت هذه اللوحة
            </button>
          ` : `
            <div class="quantity-stepper" role="group" aria-label="تحديد الكمية">
              <button type="button" class="quantity-btn" id="qty-minus" aria-label="إنقاص الكمية">-</button>
              <input
                type="number"
                class="quantity-input"
                id="qty-input"
                value="1"
                min="1"
                max="${maxStock}"
                readonly
                aria-label="الكمية المطلوبة"
              />
              <button type="button" class="quantity-btn" id="qty-plus" aria-label="زيادة الكمية">+</button>
            </div>

            <button
              type="button"
              class="btn btn-primary btn-lg"
              id="details-add-to-cart-btn"
              style="flex: 1;"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span>إضافة إلى سلة المقتنيات</span>
            </button>
          `}
        </div>

        <!-- Trust Badges -->
        <div class="gallery-guarantees">
          <div class="guarantee-item">
            <span class="guarantee-icon">🛡️</span>
            <span><strong>شهادة أصالة معتمدة:</strong> مرفقة وموقعة يدوياً من الفنان وإدارة المعرض.</span>
          </div>
          <div class="guarantee-item">
            <span class="guarantee-icon">📦</span>
            <span><strong>تغليف احترافي مؤمن:</strong> صناديق مبطنة مخصصة لحماية اللوحات الفنية أثناء الشحن.</span>
          </div>
          <div class="guarantee-item">
            <span class="guarantee-icon">🚚</span>
            <span><strong>توصيل مجاني:</strong> لجميع أنحاء الجمهورية خلال 3-5 أيام عمل.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Quantity Stepper Listeners
  const qtyInput = document.getElementById('qty-input');
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');

  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      if (val > 1) {
        val--;
        qtyInput.value = val;
        currentQuantity = val;
      }
    });

    qtyPlus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      if (val < maxStock) {
        val++;
        qtyInput.value = val;
        currentQuantity = val;
      } else {
        showToast(`الحد الأقصى المتاح من هذا العمل هو ${maxStock} قطعة فقط`, 'warning');
      }
    });
  }

  // Attach Add to Cart listener
  const addToCartBtn = document.getElementById('details-add-to-cart-btn');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', async () => {
      const success = addToCart(product.id, currentQuantity);
      if (success) {
        showToast(`تمت إضافة ${currentQuantity} من "${product.name}" إلى سلتك`, 'success');

        // Track add_to_cart event with product UUID and quantity
        await trackEvent(EVENT_TYPES.ADD_TO_CART, {
          productId: product.id,
          metadata: {
            source: 'product_details_page',
            quantity: currentQuantity
          }
        });
      }
    });
  }
}

/**
 * Loads and displays related artworks in the same category
 * @param {object} product
 */
function loadRelatedProducts(product) {
  const container = document.getElementById('related-products-grid');
  if (!container) return;

  const catalog = isSupabaseConfigured() ? CONFIG.FALLBACK_CATALOG : CONFIG.FALLBACK_CATALOG;
  const related = catalog
    .filter(p => p.id !== product.id && (p.category === product.category || true))
    .slice(0, 3);

  if (related.length === 0) return;

  container.innerHTML = related.map(rel => `
    <article class="artwork-card">
      <a href="product.html?id=${encodeURIComponent(rel.id)}" class="artwork-card-image-box">
        <img
          src="${escapeHtml(rel.image_url || ART_FALLBACK_IMG)}"
          alt="${escapeHtml(rel.name)}"
          class="artwork-card-img"
          loading="lazy"
          onerror="this.onerror=null; this.src='${ART_FALLBACK_IMG}';"
        />
      </a>
      <div class="artwork-card-body">
        <h3 class="artwork-card-title">
          <a href="product.html?id=${encodeURIComponent(rel.id)}">${escapeHtml(rel.name)}</a>
        </h3>
        <p class="artwork-card-artist">${escapeHtml(rel.artist)}</p>
        <div class="artwork-card-footer">
          <span class="artwork-card-price">${formatPrice(rel.price, rel.currency)}</span>
          <a href="product.html?id=${encodeURIComponent(rel.id)}" class="btn btn-sm btn-outline">مشاهدة العمل</a>
        </div>
      </div>
    </article>
  `).join('');
}

/**
 * Renders an accessible Not Found state
 */
function renderNotFoundState() {
  const container = document.getElementById('product-details-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state" style="margin: var(--space-12) auto; max-width: 600px;">
      <div class="empty-state-icon">🔍</div>
      <h1 class="empty-state-title">العمل الفني غير موجود</h1>
      <p class="empty-state-desc">
        عذراً، لم نتمكن من العثور على العمل الفني المطلوب. ربما تم نقله أو حذفه أو أن المعرف (UUID) في الرابط غير صحيح.
      </p>
      <a href="index.html" class="btn btn-primary">العودة إلى المعرض الرئيسي</a>
    </div>
  `;
}

// Initialization
function init() {
  initCommonUI();
  initStorefrontTracking();

  const productId = getProductIdFromUrl();
  if (!productId) {
    renderNotFoundState();
  } else {
    loadProductDetails(productId);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


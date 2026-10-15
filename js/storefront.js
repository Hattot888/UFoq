/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Storefront Homepage Controller
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import { formatPrice, escapeHtml, addToCart, showToast, initCommonUI } from './common.js';
import { trackEvent, EVENT_TYPES, initStorefrontTracking } from './analytics.js';

// State
let allProducts = [];
let filteredProducts = [];
let popularityMap = new Map(); // productId -> viewCount
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'newest';

/**
 * Fallback placeholder SVG image for broken artwork URLs
 */
const ART_FALLBACK_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 450' width='600' height='450'%3E%3Crect width='600' height='450' fill='%23EFEBE3'/%3E%3Cpath d='M220 280 L280 200 L340 260 L400 170 L480 280 Z' fill='%23D5CEC3'/%3E%3Ccircle cx='250' cy='150' r='35' fill='%23D5CEC3'/%3E%3Ctext x='50%25' y='80%25' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%2377736D'%3E%D8%A5%D8%B7%D8%A7%D8%B1 %D8%B9%D9%85%D9%84 %D9%81%D9%86%D9%8A%3C/text%3E%3C/svg%3E`;

/**
 * Fetches products from Supabase or uses fallback catalog
 */
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Render skeletons while loading
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="artwork-card skeleton" style="min-height: 380px;"></div>
  `).join('');

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        allProducts = data;
      } else {
        // Fallback to sample catalog if database table is currently empty
        console.info('Products table in Supabase is empty. Using sample catalog.');
        allProducts = CONFIG.FALLBACK_CATALOG;
      }
    } catch (err) {
      console.warn('Failed to load products from Supabase, using sample catalog:', err.message);
      allProducts = CONFIG.FALLBACK_CATALOG;
    }
  } else {
    // Unconfigured mode: use sample catalog
    allProducts = CONFIG.FALLBACK_CATALOG;
  }

  // Load real popularity data
  await loadPopularityData();

  renderCategories();
  applyFiltersAndRender();
}

/**
 * Loads real product views from Supabase via get_product_popularity() RPC
 */
async function loadPopularityData() {
  popularityMap.clear();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_product_popularity');
      if (!error && Array.isArray(data)) {
        data.forEach(item => {
          if (item.product_id) {
            popularityMap.set(item.product_id, parseInt(item.view_count, 10) || 0);
          }
        });
      }
    } catch (e) {
      console.warn('Could not load popularity stats from RPC:', e.message);
    }
  }
}

/**
 * Dynamically extract and render category filter pills
 */
function renderCategories() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
  container.innerHTML = `
    <button type="button" class="category-pill active" data-category="all">كافة الأعمال (${allProducts.length})</button>
    ${categories.map(cat => {
      const count = allProducts.filter(p => p.category === cat).length;
      return `<button type="button" class="category-pill" data-category="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</button>`;
    }).join('')}
  `;

  // Attach event listeners to pills
  container.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      applyFiltersAndRender();
    });
  });
}

/**
 * Filters and sorts products based on user interactions
 */
function applyFiltersAndRender() {
  filteredProducts = allProducts.filter(product => {
    // Category filter
    if (currentCategory !== 'all' && product.category !== currentCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const nameMatch = product.name?.toLowerCase().includes(query);
      const artistMatch = product.artist?.toLowerCase().includes(query);
      const descMatch = product.description?.toLowerCase().includes(query);
      if (!nameMatch && !artistMatch && !descMatch) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filteredProducts.sort((a, b) => {
    if (currentSort === 'price_asc') {
      return Number(a.price) - Number(b.price);
    }
    if (currentSort === 'price_desc') {
      return Number(b.price) - Number(a.price);
    }
    if (currentSort === 'popular') {
      const viewsA = popularityMap.get(a.id) || 0;
      const viewsB = popularityMap.get(b.id) || 0;
      return viewsB - viewsA;
    }
    // Default: 'newest'
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });

  renderProductGrid();
}

/**
 * Renders the products grid
 */
function renderProductGrid() {
  const grid = document.getElementById('products-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  if (countEl) {
    countEl.textContent = `عرض ${filteredProducts.length} من أصل ${allProducts.length} عمل فني`;
  }

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🎨</div>
        <h3 class="empty-state-title">لم نجد أي عمل فني يطابق بحثك</h3>
        <p class="empty-state-desc">جرّب البحث بكلمات أخرى أو اختر فئة مختلفة لمشاهدة باقي اللوحات الفنية.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="reset-filters-btn">إعادة ضبط الفلاتر</button>
      </div>
    `;

    document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
      currentCategory = 'all';
      searchQuery = '';
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      renderCategories();
      applyFiltersAndRender();
    });
    return;
  }

  grid.innerHTML = filteredProducts.map(product => {
    const isOutOfStock = product.stock_quantity <= 0;
    const viewsCount = popularityMap.get(product.id) || 0;

    return `
      <article class="artwork-card" data-product-id="${escapeHtml(product.id)}">
        <a href="product.html?id=${encodeURIComponent(product.id)}" class="artwork-card-image-box" aria-label="عرض تفاصيل ${escapeHtml(product.name)}">
          <img
            src="${escapeHtml(product.image_url || ART_FALLBACK_IMG)}"
            alt="${escapeHtml(product.name)} - رسم ${escapeHtml(product.artist)}"
            class="artwork-card-img"
            loading="lazy"
            onerror="this.onerror=null; this.src='${ART_FALLBACK_IMG}';"
          />
          ${product.category ? `<span class="artwork-card-badge">${escapeHtml(product.category)}</span>` : ''}
        </a>

        <div class="artwork-card-body">
          <div class="artwork-card-meta">
            <span>${escapeHtml(product.medium || 'عمل أصلي')}</span>
            ${viewsCount > 0 ? `<span title="عدد المشاهدات">${viewsCount} مشاهدة 👁</span>` : ''}
          </div>

          <h3 class="artwork-card-title">
            <a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
          </h3>
          <p class="artwork-card-artist">${escapeHtml(product.artist || 'فنان معاصر')}</p>

          <div class="artwork-card-footer">
            <div class="artwork-card-price">${formatPrice(product.price, product.currency)}</div>
            <div class="artwork-card-actions">
              ${isOutOfStock ? `
                <span class="btn-quick-add sold-out-badge" title="نفدت الكمية">نفدت</span>
              ` : `
                <button
                  type="button"
                  class="btn-quick-add add-to-cart-btn"
                  data-id="${escapeHtml(product.id)}"
                  data-name="${escapeHtml(product.name)}"
                  title="إضافة إلى سلة المقتنيات"
                  aria-label="إضافة ${escapeHtml(product.name)} إلى السلة"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                </button>
              `}
              <a href="product.html?id=${encodeURIComponent(product.id)}" class="btn btn-sm btn-outline" style="padding: 0.35rem 0.65rem;">تفاصيل</a>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach quick add to cart listeners
  grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const productId = btn.getAttribute('data-id');
      const productName = btn.getAttribute('data-name');

      const success = addToCart(productId, 1);
      if (success) {
        showToast(`تمت إضافة "${productName}" إلى سلة المقتنيات بنجاح`, 'success');

        // Track real add_to_cart event
        await trackEvent(EVENT_TYPES.ADD_TO_CART, {
          productId: productId,
          metadata: {
            source: 'storefront_quick_add',
            quantity: 1
          }
        });
      }
    });
  });
}

/**
 * Initialize Storefront UI and Event Listeners
 */
function init() {
  initCommonUI();
  initStorefrontTracking();

  // Search input handler
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value;
        applyFiltersAndRender();
      }, 250);
    });
  }

  // Sort selector handler
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  loadProducts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Admin Dashboard Main Controller
 *
 * Verifies Supabase Auth session & checks public.admin_users table authorization.
 * Coordinates KPI rendering, SVG charts, product performance tables, and catalog management.
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase, getCurrentUser, isCurrentUserAdmin, withTimeout, initError } from './supabase.js';
import { AdminAnalyticsService } from './admin-analytics.js';
import { AdminProductsManager } from './admin-products.js';
import { formatPrice, escapeHtml, showToast } from './common.js';

const analyticsService = new AdminAnalyticsService();
let productsManager = null;
let currentTab = 'overview';
let isDashboardInitialized = false;

/**
 * Ensures the loading overlay is cleanly hidden on all exit paths
 */
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('admin-auth-loading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

/**
 * Renders an unconfigured guidance state when Supabase credentials are missing
 */
function renderUnconfiguredState() {
  hideLoadingOverlay();
  const dashboardContainer = document.getElementById('admin-dashboard-container');
  const unauthorizedCard = document.getElementById('admin-unauthorized-card');

  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (unauthorizedCard) {
    unauthorizedCard.style.display = 'block';
    unauthorizedCard.innerHTML = `
      <div class="empty-state" style="max-width: 650px; margin: var(--space-12) auto; text-align: right;">
        <div style="text-align: center; margin-bottom: var(--space-4);">
          <span style="font-size: 3rem;">⚙️</span>
          <h2 class="empty-state-title">إعداد وربط لوحة التحكم بـ Supabase</h2>
        </div>
        <p class="empty-state-desc" style="text-align: right; max-width: 100%;">
          لوحة التحكم مصممة لعرض تحليلات وإحصائيات حقيقية مسجلة من نشاط الزوار في قاعدة بيانات PostgreSQL.
          <br/><br/>
          <strong>خطوات تفعيل لوحة التحكم في 3 دقائق:</strong>
          <ol style="margin-right: 1.5rem; margin-top: 0.5rem; font-size: var(--font-size-sm); line-height: 1.8;">
            <li>أنشئ مشروعاً مجانياً على موقع <a href="https://supabase.com" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">Supabase.com</a>.</li>
            <li>افتح <code>SQL Editor</code> ونفذ محتوى الملف <code>supabase/schema.sql</code>.</li>
            <li>انسخ رابط المشروع ومفتاح <code>anon public</code> وضعهما في ملف <code>js/config.js</code>.</li>
            <li>سجل حساب جديد عبر المتجر ثم فوّض معرفك كمدير في جدول <code>admin_users</code>.</li>
          </ol>
        </p>
        <div style="display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-6);">
          <a href="index.html" class="btn btn-outline">العودة للمتجر والمعرض</a>
          <button type="button" class="btn btn-primary" onclick="window.location.reload()">تحديث الصفحة بعد الإعداد ⟳</button>
        </div>
      </div>
    `;
  }
}

/**
 * Renders an error state when Supabase client fails to connect
 * @param {string} errorDetails
 */
function renderConnectionErrorState(errorDetails = '') {
  hideLoadingOverlay();
  const dashboardContainer = document.getElementById('admin-dashboard-container');
  const unauthorizedCard = document.getElementById('admin-unauthorized-card');

  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (unauthorizedCard) {
    unauthorizedCard.style.display = 'block';
    unauthorizedCard.innerHTML = `
      <div class="empty-state" style="max-width: 600px; margin: var(--space-12) auto; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">⚠️</div>
        <h2 class="empty-state-title" style="color: var(--color-error);">تعذر الاتصال بخادم قاعدة البيانات</h2>
        <p class="empty-state-desc" style="margin-bottom: var(--space-4);">
          حدث تعثر أثناء الاتصال بمشروع Supabase أو انتهاء مهلة الاستجابة. يرجى التحقق من اتصال الإنترنت أو صحة بيانات المشروع.
        </p>
        ${errorDetails ? `<pre class="sql-snippet-box" style="text-align: left; margin-bottom: var(--space-4);">${escapeHtml(errorDetails)}</pre>` : ''}
        <div style="display: flex; gap: var(--space-3); justify-content: center;">
          <button type="button" class="btn btn-primary" onclick="window.location.reload()">إعادة المحاولة ⟳</button>
          <a href="index.html" class="btn btn-outline">العودة للمتجر</a>
        </div>
      </div>
    `;
  }
}

/**
 * Renders unauthenticated state with prompt to log in
 */
function renderLoginRequiredState() {
  hideLoadingOverlay();
  const dashboardContainer = document.getElementById('admin-dashboard-container');
  const unauthorizedCard = document.getElementById('admin-unauthorized-card');

  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (unauthorizedCard) {
    unauthorizedCard.style.display = 'block';
    unauthorizedCard.innerHTML = `
      <div class="empty-state" style="max-width: 520px; margin: var(--space-16) auto; text-align: center;">
        <div class="empty-state-icon">🔒</div>
        <h2 class="empty-state-title">تسجيل الدخول مطلوب</h2>
        <p class="empty-state-desc">
          تحتاج إلى تسجيل الدخول بحساب المدير المصرح له للوصول إلى لوحة التحكم والتحليلات الحية.
        </p>
        <div style="display: flex; gap: var(--space-3); justify-content: center; margin-top: var(--space-4);">
          <a href="login.html?returnUrl=admin.html" class="btn btn-primary">تسجيل الدخول كمسؤول</a>
          <a href="index.html" class="btn btn-outline">العودة للمعرض</a>
        </div>
      </div>
    `;
  }
}

/**
 * Renders unauthorized message for authenticated non-admin users
 * @param {object} user - Supabase user object
 */
function renderUnauthorizedAdminState(user) {
  hideLoadingOverlay();
  const dashboardContainer = document.getElementById('admin-dashboard-container');
  const unauthorizedCard = document.getElementById('admin-unauthorized-card');

  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (unauthorizedCard) {
    unauthorizedCard.style.display = 'block';
    unauthorizedCard.innerHTML = `
      <div class="empty-state" style="max-width: 650px; margin: var(--space-12) auto; text-align: right;">
        <div style="text-align: center; margin-bottom: var(--space-4);">
          <span style="font-size: 3rem;">⛔</span>
          <h2 class="empty-state-title" style="color: var(--color-error); margin-top: var(--space-2);">الوصول محظور: حساب غير مصرح له كمسؤول</h2>
        </div>
        <p class="empty-state-desc" style="text-align: right; max-width: 100%;">
          أنت مسجل حالياً بالبريد الإلكتروني: <strong>${escapeHtml(user.email || 'مستخدم')}</strong>
          <br/><br/>
          لوحة الإدارة والتحليلات مخصصة حصرياً للمديرين المعتمدين في النظام. لا يمتلك حسابك الحالي صلاحيات إدارية كافية لعرض هذه الصفحة أو الوصول إلى سجلاتها.
        </p>
        <div style="display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-6); flex-wrap: wrap;">
          <a href="index.html" class="btn btn-primary">العودة إلى المعرض الرئيسي &rarr;</a>
          <button type="button" class="btn btn-outline" id="unauthorized-logout-btn">تسجيل الخروج والتبديل لحساب آخر</button>
        </div>
      </div>
    `;

    document.getElementById('unauthorized-logout-btn')?.addEventListener('click', async () => {
      try {
        if (supabase) await supabase.auth.signOut();
      } catch (e) {}
      window.location.href = 'login.html?returnUrl=admin.html';
    });
  }
}

/**
 * Verifies user session and admin authorization with timeout protection
 * @returns {Promise<boolean>}
 */
async function verifyAdminAccess() {
  const unauthorizedCard = document.getElementById('admin-unauthorized-card');
  const dashboardContainer = document.getElementById('admin-dashboard-container');

  // 1. Check configuration
  if (!isSupabaseConfigured()) {
    renderUnconfiguredState();
    return false;
  }

  // 2. Check client initialization
  if (!supabase) {
    renderConnectionErrorState(initError ? initError.message : 'لم يتم تهيئة عميل Supabase بنجاح.');
    return false;
  }

  try {
    // 3. Check authenticated user (with timeout)
    const userPromise = getCurrentUser();
    const user = await withTimeout(userPromise, 6000, null);

    if (!user) {
      renderLoginRequiredState();
      return false;
    }

    // 4. Check admin status in database (with timeout)
    const adminCheckPromise = isCurrentUserAdmin();
    const isAdmin = await withTimeout(adminCheckPromise, 6000, false);

    if (!isAdmin) {
      renderUnauthorizedAdminState(user);
      return false;
    }

    // 5. Authorized Admin!
    hideLoadingOverlay();
    if (unauthorizedCard) unauthorizedCard.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'flex';

    // Set Admin Email in Header
    const adminEmailEl = document.getElementById('admin-user-email');
    if (adminEmailEl) adminEmailEl.textContent = user.email || 'مسؤول المعرض';

    return true;
  } catch (err) {
    console.error('Error during admin verification:', err);
    renderConnectionErrorState(err.message || 'حدث خطأ غير متوقع أثناء فحص الصلاحيات.');
    return false;
  }
}

/**
 * Initializes and refreshes dashboard analytics data
 */
async function refreshDashboardData() {
  const refreshBtn = document.getElementById('refresh-dashboard-btn');
  if (refreshBtn) {
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
  }

  try {
    // Load products catalog for cross-referencing
    await analyticsService.loadProductsCatalog();

    // Fetch real analytics events from database
    const result = await analyticsService.fetchEvents();

    const connectionStatusEl = document.getElementById('connection-status-pill');
    if (connectionStatusEl) {
      if (result.success) {
        connectionStatusEl.className = 'health-status-badge connected';
        connectionStatusEl.innerHTML = '<span class="status-dot"></span> متصل بقاعدة البيانات';
      } else {
        connectionStatusEl.className = 'health-status-badge disconnected';
        connectionStatusEl.innerHTML = `<span class="status-dot"></span> خطأ في جلب البيانات`;
        if (result.error && result.error !== 'SUPABASE_NOT_CONFIGURED') {
          showToast(`خطأ في استعلام التحليلات: ${result.error}`, 'error', 5000);
        }
      }
    }

    // Render KPI cards
    renderKPICards(result);

    // Render Visual Charts
    renderTimelineChart(result);
    renderFunnelChart(result);

    // Render Product Performance Table
    renderProductPerformanceTable(result);
  } catch (err) {
    console.error('Failed to refresh dashboard data:', err);
    showToast('حدث خطأ أثناء استحضار التحليلات: ' + err.message, 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove('loading');
      refreshBtn.disabled = false;
    }
  }
}

/**
 * Renders the 8 primary KPI cards with real recorded counts.
 * Strictly distinguishes query errors from genuine zero counts.
 * @param {object} [fetchResult]
 */
function renderKPICards(fetchResult) {
  const isError = fetchResult && !fetchResult.success;
  const kpis = isError ? null : analyticsService.calculateKPIs();

  const setCard = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      if (isError) {
        el.textContent = '—';
        el.title = 'تعذر تحميل الإحصائية بسبب خطأ في الاستعلام أو الصلاحيات';
      } else {
        el.textContent = Number(val || 0).toLocaleString('ar-EG');
        el.title = '';
      }
    }
  };

  setCard('kpi-site-visits', kpis?.siteVisits);
  setCard('kpi-distinct-visitors', kpis?.distinctVisitors);
  setCard('kpi-page-views', kpis?.pageViews);
  setCard('kpi-product-views', kpis?.productViews);
  setCard('kpi-add-to-carts', kpis?.addToCartEvents);
  setCard('kpi-cart-visitors', kpis?.cartVisitors);
  setCard('kpi-signups', kpis?.signUps);
  setCard('kpi-logins', kpis?.logins);

  const zeroStateNotice = document.getElementById('analytics-zero-notice');
  if (zeroStateNotice) {
    if (isError) {
      zeroStateNotice.style.display = 'block';
      zeroStateNotice.style.backgroundColor = 'var(--color-error-bg)';
      zeroStateNotice.style.color = 'var(--color-error)';
      zeroStateNotice.style.borderColor = '#F2C2C2';
      zeroStateNotice.innerHTML = `⚠️ <strong>تعذر استعلام سجلات التحليلات من Supabase:</strong> ${escapeHtml(fetchResult.error || 'خطأ غير معروف')}.<br><small style="margin-top: 4px; display: inline-block;">يرجى التأكد من تنفيذ ملف الصلاحيات <code>supabase/migration_fix_permissions.sql</code> في محرر SQL الخاص بـ Supabase.</small>`;
    } else if (kpis && kpis.totalEvents === 0) {
      zeroStateNotice.style.display = 'block';
      zeroStateNotice.style.backgroundColor = '';
      zeroStateNotice.style.color = '';
      zeroStateNotice.style.borderColor = '';
      zeroStateNotice.innerHTML = `ℹ️ بدأ نظام التحليلات الآن؛ لا توجد أحداث مسجلة بعد في هذا النطاق الزمني. تصفح المتجر وافتح اللوحات لتسجيل أولى الزيارات الحية!`;
    } else {
      zeroStateNotice.style.display = 'none';
    }
  }
}

/**
 * Renders an accessible, responsive SVG timeline chart
 * @param {object} [fetchResult]
 */
function renderTimelineChart(fetchResult) {
  const container = document.getElementById('timeline-chart-container');
  if (!container) return;

  if (fetchResult && !fetchResult.success) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--color-error); font-size: var(--font-size-sm);">
        <span>⚠️ تعذر تحميل الرسم البياني للزيارات بسبب خطأ في الاستعلام (${escapeHtml(fetchResult.error || '')}).</span>
      </div>
    `;
    return;
  }

  const data = analyticsService.getDailyTimeline();

  if (data.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--text-muted); font-size: var(--font-size-sm);">
        <span>📊 لا توجد أحداث مسجلة في هذا النطاق الزمني بعد. تصفح المعرض وأضف أعمالاً للسلة لتسجيل التحليلات الحية.</span>
      </div>
    `;
    return;
  }

  // Find max value for scaling
  const maxVal = Math.max(...data.map(d => Math.max(d.visits, d.productViews, d.cartAdds)), 5);
  const chartHeight = 220;
  const chartWidth = 560;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const barGroupWidth = innerWidth / data.length;
  const barWidth = Math.max(6, Math.min(22, (barGroupWidth - 10) / 3));

  const barsSvg = data.map((d, i) => {
    const groupX = padding.left + i * barGroupWidth;

    const hVisits = (d.visits / maxVal) * innerHeight;
    const hViews = (d.productViews / maxVal) * innerHeight;
    const hAdds = (d.cartAdds / maxVal) * innerHeight;

    const yVisits = padding.top + (innerHeight - hVisits);
    const yViews = padding.top + (innerHeight - hViews);
    const yAdds = padding.top + (innerHeight - hAdds);

    return `
      <g class="chart-group" data-date="${escapeHtml(d.date)}">
        <!-- Visits bar -->
        <rect x="${groupX}" y="${yVisits}" width="${barWidth}" height="${hVisits}" fill="#242321" rx="2">
          <title>${d.date}: ${d.visits} زيارة</title>
        </rect>
        <!-- Views bar -->
        <rect x="${groupX + barWidth + 2}" y="${yViews}" width="${barWidth}" height="${hViews}" fill="#A75D45" rx="2">
          <title>${d.date}: ${d.productViews} مشاهدة تفاصيل</title>
        </rect>
        <!-- Cart Adds bar -->
        <rect x="${groupX + (barWidth * 2) + 4}" y="${yAdds}" width="${barWidth}" height="${hAdds}" fill="#287A55" rx="2">
          <title>${d.date}: ${d.cartAdds} إضافة للسلة</title>
        </rect>
        <!-- X-axis Label -->
        <text x="${groupX + barGroupWidth / 2}" y="${chartHeight - 10}" class="chart-axis-label">${escapeHtml(d.label)}</text>
      </g>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="analytics-svg-chart" role="img" aria-label="رسم بياني لتطور الزيارات والمشاهدات اليومية">
      <!-- Grid lines -->
      <line x1="${padding.left}" y1="${padding.top}" x2="${chartWidth - padding.right}" y2="${padding.top}" class="chart-grid-line" />
      <line x1="${padding.left}" y1="${padding.top + innerHeight / 2}" x2="${chartWidth - padding.right}" y2="${padding.top + innerHeight / 2}" class="chart-grid-line" />
      <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" class="chart-axis-line" />

      <!-- Bars -->
      ${barsSvg}
    </svg>

    <div style="display: flex; gap: var(--space-4); justify-content: center; margin-top: var(--space-3); font-size: 0.75rem;">
      <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #242321; border-radius: 2px;"></span> زيارات الموقع</span>
      <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #A75D45; border-radius: 2px;"></span> استعراض اللوحات</span>
      <span style="display: inline-flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; background: #287A55; border-radius: 2px;"></span> إضافات للسلة</span>
    </div>
  `;
}

/**
 * Renders behavioral funnel progression bars
 * @param {object} [fetchResult]
 */
function renderFunnelChart(fetchResult) {
  const container = document.getElementById('funnel-chart-container');
  if (!container) return;

  if (fetchResult && !fetchResult.success) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--color-error); font-size: var(--font-size-sm);">
        <span>⚠️ تعذر احتساب مسار التحويل بسبب تعذر الوصول إلى سجلات التحليلات.</span>
      </div>
    `;
    return;
  }

  const funnelSteps = analyticsService.getBehavioralFunnel();

  container.innerHTML = `
    <div class="funnel-list">
      ${funnelSteps.map(step => `
        <div class="funnel-step">
          <div class="funnel-step-header">
            <span>${escapeHtml(step.name)}</span>
            <span style="font-weight: 700;">${step.count.toLocaleString('ar-EG')} حدث (${step.percent}%)</span>
          </div>
          <div class="funnel-bar-bg">
            <div class="funnel-bar-fill" style="width: ${Math.max(4, step.percent)}%;">
              ${step.percent > 15 ? `${step.percent}%` : ''}
            </div>
          </div>
          ${step.dropoff !== null ? `
            <span class="funnel-dropoff">نسبة الانقطاع (Drop-off): ${step.dropoff}%</span>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Renders Product Performance Table
 * @param {object} [fetchResult]
 */
function renderProductPerformanceTable(fetchResult) {
  const tbody = document.getElementById('analytics-products-tbody');
  if (!tbody) return;

  if (fetchResult && !fetchResult.success) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: var(--space-8); color: var(--color-error);">
          ⚠️ تعذر استعراض تفاعل اللوحات الفنية بسبب خطأ في الاستعلام (${escapeHtml(fetchResult.error || '')}). يرجى التحقق من صلاحيات RLS.
        </td>
      </tr>
    `;
    return;
  }

  const products = analyticsService.getProductPerformance();

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
          لا توجد سجلات تطابق البحث الحالي
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <img
          src="${escapeHtml(p.image_url || '')}"
          alt="${escapeHtml(p.name)}"
          class="table-thumb"
          onerror="this.style.display='none'"
        />
      </td>
      <td>
        <strong>${escapeHtml(p.name)}</strong>
        <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(p.artist)}</span>
      </td>
      <td><strong>${formatPrice(p.price, p.currency)}</strong></td>
      <td><strong>${p.views}</strong></td>
      <td><strong>${p.addsToCart}</strong></td>
      <td>${p.uniqueAdders}</td>
      <td>
        ${p.conversionRate !== null
          ? `<span style="font-weight: 700; color: var(--accent-primary);">${p.conversionRate}%</span>`
          : '<span style="color: var(--text-muted); font-size: 0.8rem;">بيانات غير كافية</span>'}
      </td>
    </tr>
  `).join('');
}

/**
 * Setup navigation tabs in Admin sidebar
 */
function initAdminTabs() {
  const tabLinks = document.querySelectorAll('.sidebar-link[data-tab]');
  const tabSections = document.querySelectorAll('.admin-tab-section');

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');

      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      tabSections.forEach(sec => {
        if (sec.id === `tab-${tab}`) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });

      currentTab = tab;
      if (tab === 'products' && productsManager) {
        productsManager.loadProducts();
      }
    });
  });

  // Mobile sidebar toggle
  const mobileToggle = document.getElementById('admin-sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target) && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }
}

/**
 * Main dashboard startup logic
 */
async function startDashboard() {
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;

  const isAuthorized = await verifyAdminAccess();
  if (!isAuthorized) return;

  // Initialize Tab Navigation
  initAdminTabs();

  // Initialize Product Catalog Manager
  productsManager = new AdminProductsManager(async () => {
    await refreshDashboardData();
  });

  // Wire Date Filter
  const dateFilterSelect = document.getElementById('date-range-filter');
  if (dateFilterSelect) {
    dateFilterSelect.addEventListener('change', async (e) => {
      analyticsService.currentDateFilter = e.target.value;
      await refreshDashboardData();
    });
  }

  // Wire Refresh Button
  document.getElementById('refresh-dashboard-btn')?.addEventListener('click', async () => {
    await refreshDashboardData();
    showToast('تم تحديث بيانات التحليلات بنجاح', 'info');
  });

  // Wire CSV Export Button
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    analyticsService.exportToCSV();
  });

  // Wire Product Performance Table Sort & Search
  const tableSearch = document.getElementById('perf-table-search');
  if (tableSearch) {
    tableSearch.addEventListener('input', (e) => {
      analyticsService.productSearchQuery = e.target.value;
      renderProductPerformanceTable();
    });
  }

  const tableSort = document.getElementById('perf-table-sort');
  if (tableSort) {
    tableSort.addEventListener('change', (e) => {
      analyticsService.productSortField = e.target.value;
      renderProductPerformanceTable();
    });
  }

  // Wire Product Management Search & Modal
  document.getElementById('btn-open-create-product')?.addEventListener('click', () => {
    productsManager.openCreateModal();
  });

  document.getElementById('close-product-modal-btn')?.addEventListener('click', () => {
    productsManager.closeModal();
  });

  document.getElementById('cancel-product-modal-btn')?.addEventListener('click', () => {
    productsManager.closeModal();
  });

  document.getElementById('product-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await productsManager.saveProductFromForm();
  });

  const prodSearchInput = document.getElementById('admin-products-search');
  if (prodSearchInput) {
    prodSearchInput.addEventListener('input', (e) => {
      productsManager.searchQuery = e.target.value;
      productsManager.renderTable();
    });
  }

  // Wire Logout Button
  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) {}
    window.location.href = 'index.html';
  });

  // Initial Data Fetch
  await refreshDashboardData();
}

// React immediately if auth state changes (e.g. administrator signs out)
window.addEventListener('horizon-auth-change', async (e) => {
  const { event, session } = e.detail || {};
  if (event === 'SIGNED_OUT' || !session) {
    const dashboardContainer = document.getElementById('admin-dashboard-container');
    if (dashboardContainer) dashboardContainer.style.display = 'none';
    renderLoginRequiredState();
  }
});

// Resilient event listener that triggers whether DOM is already ready or still loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startDashboard);
} else {
  startDashboard();
}

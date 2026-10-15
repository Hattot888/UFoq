/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Admin Analytics Engine
 *
 * Fetches real telemetry events from `analytics_events` table in Supabase,
 * computes KPIs, product performance matrices, conversion funnels, and time series charts.
 * Never fabricates fake statistics.
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import { formatPrice, escapeHtml } from './common.js';

export class AdminAnalyticsService {
  constructor() {
    this.rawEvents = [];
    this.productsMap = new Map();
    this.currentDateFilter = '7d'; // 'today' | '7d' | '30d' | 'all'
    this.productSearchQuery = '';
    this.productSortField = 'views';
    this.productSortOrder = 'desc';
  }

  /**
   * Loads products catalog to cross-reference product IDs with titles and images
   */
  async loadProductsCatalog() {
    this.productsMap.clear();

    // Load fallback list first
    CONFIG.FALLBACK_CATALOG.forEach(p => this.productsMap.set(p.id, p));

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*');

        if (!error && Array.isArray(data)) {
          data.forEach(p => this.productsMap.set(p.id, p));
        }
      } catch (err) {
        console.warn('Could not load products catalog for analytics:', err);
      }
    }
  }

  /**
   * Fetches real raw analytics events from Supabase
   * @returns {Promise<{ success: boolean, count: number, error?: string }>}
   */
  async fetchEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        count: 0,
        error: 'SUPABASE_NOT_CONFIGURED'
      };
    }

    try {
      // Build date threshold based on filter
      let query = supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: true });

      const startDate = this.getStartDateForFilter(this.currentDateFilter);
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          count: 0,
          error: error.message
        };
      }

      this.rawEvents = data || [];
      return {
        success: true,
        count: this.rawEvents.length
      };
    } catch (err) {
      return {
        success: false,
        count: 0,
        error: err.message
      };
    }
  }

  /**
   * Returns Date object threshold for filter
   * @param {string} filter
   * @returns {Date|null}
   */
  getStartDateForFilter(filter) {
    const now = new Date();
    if (filter === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }
    if (filter === '7d') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (filter === '30d') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null; // 'all'
  }

  /**
   * Computes the 8 primary business KPIs from real recorded events
   */
  calculateKPIs() {
    const events = this.rawEvents;

    const siteVisits = events.filter(e => e.event_type === 'site_visit').length;

    // Distinct visitors across all events
    const distinctVisitors = new Set(
      events.map(e => e.visitor_id).filter(Boolean)
    ).size;

    const pageViews = events.filter(e => e.event_type === 'page_view').length;
    const productViews = events.filter(e => e.event_type === 'product_view').length;
    const addToCartEvents = events.filter(e => e.event_type === 'add_to_cart').length;

    // Distinct visitors who added an item to cart
    const cartVisitors = new Set(
      events
        .filter(e => e.event_type === 'add_to_cart')
        .map(e => e.visitor_id)
        .filter(Boolean)
    ).size;

    const signUps = events.filter(e => e.event_type === 'sign_up').length;
    const logins = events.filter(e => e.event_type === 'login').length;

    return {
      siteVisits,
      distinctVisitors,
      pageViews,
      productViews,
      addToCartEvents,
      cartVisitors,
      signUps,
      logins,
      totalEvents: events.length
    };
  }

  /**
   * Computes product-level performance matrix
   */
  getProductPerformance() {
    const productStats = new Map();

    // Initialize map for all catalog products so products with 0 views are also visible
    this.productsMap.forEach((product, id) => {
      productStats.set(id, {
        id: id,
        name: product.name || 'بدون عنوان',
        artist: product.artist || 'فنان معاصر',
        image_url: product.image_url || '',
        price: product.price || 0,
        currency: product.currency || CONFIG.CURRENCY,
        views: 0,
        addsToCart: 0,
        distinctCartVisitors: new Set(),
        conversionRate: 0 // (adds / views) * 100
      });
    });

    // Aggregate real events
    this.rawEvents.forEach(e => {
      if (!e.product_id) return;

      if (!productStats.has(e.product_id)) {
        productStats.set(e.product_id, {
          id: e.product_id,
          name: `عمل فني (${e.product_id.slice(0, 8)}...)`,
          artist: 'غير محدد',
          image_url: '',
          price: 0,
          currency: CONFIG.CURRENCY,
          views: 0,
          addsToCart: 0,
          distinctCartVisitors: new Set(),
          conversionRate: 0
        });
      }

      const stat = productStats.get(e.product_id);
      if (e.event_type === 'product_view') {
        stat.views += 1;
      } else if (e.event_type === 'add_to_cart') {
        stat.addsToCart += 1;
        if (e.visitor_id) {
          stat.distinctCartVisitors.add(e.visitor_id);
        }
      }
    });

    // Convert to array and compute rates
    const list = Array.from(productStats.values()).map(item => {
      const uniqueAdders = item.distinctCartVisitors.size;
      const rate = item.views > 0
        ? ((item.addsToCart / item.views) * 100).toFixed(1)
        : null;

      return {
        ...item,
        uniqueAdders: uniqueAdders,
        conversionRate: rate
      };
    });

    // Filter by search query
    const filtered = list.filter(item => {
      if (!this.productSearchQuery.trim()) return true;
      const q = this.productSearchQuery.toLowerCase().trim();
      return item.name.toLowerCase().includes(q) || item.artist.toLowerCase().includes(q);
    });

    // Sort
    filtered.sort((a, b) => {
      let valA = a[this.productSortField];
      let valB = b[this.productSortField];

      if (this.productSortField === 'conversionRate') {
        valA = a.conversionRate !== null ? parseFloat(a.conversionRate) : -1;
        valB = b.conversionRate !== null ? parseFloat(b.conversionRate) : -1;
      }

      if (this.productSortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    return filtered;
  }

  /**
   * Computes daily aggregation for timeline chart
   * @returns {Array<{ date: string, label: string, visits: number, productViews: number, cartAdds: number }>}
   */
  getDailyTimeline() {
    const dailyMap = new Map();

    // Group events by YYYY-MM-DD
    this.rawEvents.forEach(e => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: key,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          visits: 0,
          productViews: 0,
          cartAdds: 0
        });
      }

      const day = dailyMap.get(key);
      if (e.event_type === 'site_visit') day.visits += 1;
      if (e.event_type === 'product_view') day.productViews += 1;
      if (e.event_type === 'add_to_cart') day.cartAdds += 1;
    });

    const result = Array.from(dailyMap.values());
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }

  /**
   * Computes behavioral funnel progression
   * Denominators are explicitly defined as total unique visitors or session steps.
   */
  getBehavioralFunnel() {
    const kpis = this.calculateKPIs();

    const step1_Visits = kpis.siteVisits;
    const step2_Views = kpis.productViews;
    const step3_Adds = kpis.addToCartEvents;
    const step4_Auth = kpis.signUps + kpis.logins;

    // Relative progression percentages
    const pctViews = step1_Visits > 0 ? Math.min(100, Math.round((step2_Views / step1_Visits) * 100)) : 0;
    const pctAdds = step2_Views > 0 ? Math.min(100, Math.round((step3_Adds / step2_Views) * 100)) : 0;
    const pctAuth = step3_Adds > 0 ? Math.min(100, Math.round((step4_Auth / step3_Adds) * 100)) : 0;

    return [
      {
        name: '1. زيارات الموقع (Site Visits)',
        count: step1_Visits,
        percent: 100,
        dropoff: null
      },
      {
        name: '2. استعراض تفاصيل اللوحات (Product Views)',
        count: step2_Views,
        percent: pctViews,
        dropoff: step1_Visits > 0 ? Math.max(0, 100 - pctViews) : null
      },
      {
        name: '3. الإضافة إلى سلة المقتنيات (Add to Cart)',
        count: step3_Adds,
        percent: pctAdds,
        dropoff: step2_Views > 0 ? Math.max(0, 100 - pctAdds) : null
      },
      {
        name: '4. التسجيل والدخول (Signups & Logins)',
        count: step4_Auth,
        percent: pctAuth,
        dropoff: step3_Adds > 0 ? Math.max(0, 100 - pctAuth) : null
      }
    ];
  }

  /**
   * Exports filtered analytics data as a CSV download
   */
  exportToCSV() {
    if (this.rawEvents.length === 0) {
      alert('لا توجد بيانات مسجلة للتصدير حالياً.');
      return;
    }

    const headers = ['المعرف', 'نوع الحدث', 'معرف اللوحة', 'معرف الزائر', 'معرف الجلسة', 'المسار', 'التاريخ والوقت'];
    const rows = this.rawEvents.map(e => [
      `"${e.id || ''}"`,
      `"${e.event_type || ''}"`,
      `"${e.product_id || ''}"`,
      `"${e.visitor_id || ''}"`,
      `"${e.session_id || ''}"`,
      `"${e.page_path || ''}"`,
      `"${e.created_at || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `horizon_analytics_${this.currentDateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

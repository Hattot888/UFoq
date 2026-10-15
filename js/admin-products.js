/**
 * HORIZON CONTEMPORARY ART GALLERY
 * Admin Product Catalog Management
 *
 * Full CRUD for paintings and artworks backed by Supabase with Row Level Security.
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { supabase } from './supabase.js';
import { formatPrice, escapeHtml, showToast } from './common.js';

export class AdminProductsManager {
  constructor(onProductsChangedCallback) {
    this.products = [];
    this.searchQuery = '';
    this.onProductsChanged = onProductsChangedCallback || (() => {});
  }

  /**
   * Fetches all products (including inactive) from database
   */
  async loadProducts() {
    if (!isSupabaseConfigured() || !supabase) {
      this.products = CONFIG.FALLBACK_CATALOG;
      this.renderTable();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.products = data || [];
      this.renderTable();
    } catch (err) {
      console.error('Error fetching admin products:', err);
      showToast('تعذر تحميل قائمة المنتجات من قاعدة البيانات: ' + err.message, 'error');
    }
  }

  /**
   * Renders the product management table
   */
  renderTable() {
    const tbody = document.getElementById('admin-products-tbody');
    const countEl = document.getElementById('admin-products-count');
    if (!tbody) return;

    const filtered = this.products.filter(p => {
      if (!this.searchQuery.trim()) return true;
      const q = this.searchQuery.toLowerCase().trim();
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.artist && p.artist.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    });

    if (countEl) {
      countEl.textContent = `إجمالي المنتجات: ${this.products.length} (المعروض: ${filtered.length})`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
            لا توجد أعمال فنية مطابقة للبحث
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr data-id="${escapeHtml(p.id)}">
        <td>
          <img
            src="${escapeHtml(p.image_url || '')}"
            alt="${escapeHtml(p.name)}"
            class="table-thumb"
            onerror="this.style.display='none'"
          />
        </td>
        <td>
          <strong style="color: var(--text-primary); display: block;">${escapeHtml(p.name)}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(p.artist || 'فنان معاصر')}</span>
        </td>
        <td>${escapeHtml(p.category || 'تجريدي')}</td>
        <td><strong>${formatPrice(p.price, p.currency)}</strong></td>
        <td>
          <span style="font-weight: 600; color: ${p.stock_quantity > 0 ? 'var(--text-primary)' : 'var(--color-error)'};">
            ${p.stock_quantity}
          </span>
        </td>
        <td>
          ${p.is_active
            ? '<span class="badge-active">معروض للعامة</span>'
            : '<span class="badge-inactive">مخفي / معطل</span>'}
        </td>
        <td>
          <div style="display: flex; gap: var(--space-2); justify-content: flex-end;">
            <button
              type="button"
              class="btn btn-sm btn-outline edit-product-btn"
              data-id="${escapeHtml(p.id)}"
              title="تعديل تفاصيل العمل"
            >
              تعديل
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline toggle-status-btn"
              data-id="${escapeHtml(p.id)}"
              data-active="${p.is_active}"
              title="${p.is_active ? 'إلغاء تفعيل وعرض اللوحة' : 'إعادة تفعيل وعرض اللوحة'}"
            >
              ${p.is_active ? 'إخفاء' : 'تفعيل'}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline delete-product-btn"
              data-id="${escapeHtml(p.id)}"
              title="حذف نهائي"
              style="color: var(--color-error); border-color: rgba(182, 66, 66, 0.3);"
            >
              حذف
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Wire action buttons
    tbody.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = this.products.find(item => item.id === id);
        if (p) this.openEditModal(p);
      });
    });

    tbody.querySelectorAll('.toggle-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const currentActive = btn.getAttribute('data-active') === 'true';
        await this.toggleProductActive(id, !currentActive);
      });
    });

    tbody.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await this.deleteProduct(id);
      });
    });
  }

  /**
   * Opens modal to create a new artwork
   */
  openCreateModal() {
    this.resetModalForm();
    document.getElementById('product-modal-title').textContent = 'إضافة عمل فني جديد إلى المعرض';
    document.getElementById('product-id-hidden').value = '';
    this.showModal();
  }

  /**
   * Opens modal to edit an existing artwork
   * @param {object} product
   */
  openEditModal(product) {
    this.resetModalForm();
    document.getElementById('product-modal-title').textContent = `تعديل: ${product.name}`;
    document.getElementById('product-id-hidden').value = product.id;
    document.getElementById('form-prod-name').value = product.name || '';
    document.getElementById('form-prod-artist').value = product.artist || '';
    document.getElementById('form-prod-category').value = product.category || 'تجريدي';
    document.getElementById('form-prod-price').value = product.price || '';
    document.getElementById('form-prod-stock').value = product.stock_quantity ?? 1;
    document.getElementById('form-prod-image').value = product.image_url || '';
    document.getElementById('form-prod-dimensions').value = product.dimensions || '';
    document.getElementById('form-prod-medium').value = product.medium || '';
    document.getElementById('form-prod-description').value = product.description || '';
    document.getElementById('form-prod-active').checked = Boolean(product.is_active);

    this.showModal();
  }

  showModal() {
    const modal = document.getElementById('product-editor-modal');
    if (modal) modal.classList.add('open');
  }

  closeModal() {
    const modal = document.getElementById('product-editor-modal');
    if (modal) modal.classList.remove('open');
  }

  resetModalForm() {
    const form = document.getElementById('product-editor-form');
    if (form) form.reset();
    document.getElementById('form-prod-active').checked = true;
  }

  /**
   * Saves product (Insert or Update)
   */
  async saveProductFromForm() {
    const id = document.getElementById('product-id-hidden').value;
    const name = document.getElementById('form-prod-name').value.trim();
    const artist = document.getElementById('form-prod-artist').value.trim();
    const category = document.getElementById('form-prod-category').value.trim();
    const price = parseFloat(document.getElementById('form-prod-price').value);
    const stock = parseInt(document.getElementById('form-prod-stock').value, 10);
    const image_url = document.getElementById('form-prod-image').value.trim();
    const dimensions = document.getElementById('form-prod-dimensions').value.trim();
    const medium = document.getElementById('form-prod-medium').value.trim();
    const description = document.getElementById('form-prod-description').value.trim();
    const is_active = document.getElementById('form-prod-active').checked;

    if (!name || isNaN(price) || price < 0) {
      showToast('يرجى ملء اسم اللوحة الفنية وتحديد سعر صحيح', 'error');
      return;
    }

    const payload = {
      name,
      artist: artist || 'فنان معاصر',
      category: category || 'تجريدي',
      price,
      currency: CONFIG.CURRENCY,
      stock_quantity: isNaN(stock) ? 1 : Math.max(0, stock),
      image_url: image_url || null,
      dimensions: dimensions || null,
      medium: medium || null,
      description: description || null,
      is_active
    };

    if (!isSupabaseConfigured() || !supabase) {
      showToast('قاعدة بيانات Supabase غير متصلة. لا يمكن حفظ التعديلات بشكل دائم.', 'warning');
      this.closeModal();
      return;
    }

    try {
      if (id) {
        // Update
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
        showToast('تم تحديث بيانات اللوحة الفنية بنجاح', 'success');
      } else {
        // Insert
        const { error } = await supabase
          .from('products')
          .insert([payload]);

        if (error) throw error;
        showToast('تمت إضافة العمل الفني الجديد إلى المعرض بنجاح', 'success');
      }

      this.closeModal();
      await this.loadProducts();
      this.onProductsChanged();
    } catch (err) {
      console.error('Failed to save product:', err);
      showToast('حدث خطأ أثناء حفظ العمل الفني: ' + err.message, 'error');
    }
  }

  /**
   * Toggles product active visibility status
   */
  async toggleProductActive(id, newStatus) {
    if (!isSupabaseConfigured() || !supabase) {
      showToast('قاعدة بيانات Supabase غير متصلة', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) throw error;
      showToast(newStatus ? 'تم تفعيل عرض اللوحة للجمهور' : 'تم إخفاء اللوحة من العرض العام', 'info');
      await this.loadProducts();
      this.onProductsChanged();
    } catch (err) {
      console.error('Failed to toggle status:', err);
      showToast('حدث خطأ أثناء تغيير الحالة: ' + err.message, 'error');
    }
  }

  /**
   * Deletes product after explicit confirmation
   */
  async deleteProduct(id) {
    const confirmed = confirm('هل أنت متأكد تماماً من رغبتك في حذف هذا العمل الفني؟\n(ملاحظة: سجل التحليلات التاريخية للعمل سيتم الحفاظ عليه دون الإخلال بسلامة البيانات)');
    if (!confirmed) return;

    if (!isSupabaseConfigured() || !supabase) {
      showToast('قاعدة بيانات Supabase غير متصلة', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('تم حذف العمل الفني بنجاح', 'success');
      await this.loadProducts();
      this.onProductsChanged();
    } catch (err) {
      console.error('Failed to delete product:', err);
      showToast('تعذر حذف العمل الفني: ' + err.message, 'error');
    }
  }
}

import Alpine from 'alpinejs';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { getCurrentItem } from '../lib/store.js';
import { watchCatalog, createCatalogItem } from '../data/catalog.js';
import { watchBuckets } from '../data/buckets.js';
import { updateTemplateItems } from '../data/templates.js';
import { updateTripItems } from '../data/trips.js';

function findEntry(items, itemId) {
  return items.find((entry) => entry.itemId === itemId);
}

function upsertEntry(items, itemId, patch, catalogItem) {
  const next = items.map((entry) => ({ ...entry, bucketIds: [...entry.bucketIds] }));
  const existing = next.find((entry) => entry.itemId === itemId);
  if (existing) {
    Object.assign(existing, patch);
  } else {
    next.push({
      itemId,
      bucketIds: [],
      quantity: catalogItem?.defaultQuantity || 1,
      ...patch,
    });
  }
  return next;
}

Alpine.data('prep', () => ({
  currentItem: getCurrentItem(),
  itemDoc: null,
  catalog: [],
  buckets: [],
  selectedCategories: [],
  addingItem: false,
  quantityModal: null, // catalog item currently being edited, or null
  bucketModal: null, // catalog item currently being edited, or null

  init() {
    if (!this.currentItem) return;

    const collectionName = this.currentItem.type === 'template' ? 'templates' : 'trips';
    this._unsubDoc = onSnapshot(doc(db, collectionName, this.currentItem.id), (snap) => {
      this.itemDoc = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    });
    this._unsubCatalog = watchCatalog((list) => {
      this.catalog = list;
    });
    this._unsubBuckets = watchBuckets((list) => {
      this.buckets = list;
    });
  },

  destroy() {
    this._unsubDoc?.();
    this._unsubCatalog?.();
    this._unsubBuckets?.();
  },

  get categoryNames() {
    return [...new Set(this.catalog.map((item) => item.category))].sort((a, b) =>
      a.localeCompare(b, 'de')
    );
  },

  get filteredItems() {
    const items =
      this.selectedCategories.length === 0
        ? this.catalog
        : this.catalog.filter((item) => this.selectedCategories.includes(item.category));
    return [...items].sort(
      (a, b) => a.category.localeCompare(b.category, 'de') || a.name.localeCompare(b.name, 'de')
    );
  },

  isCategorySelected(category) {
    return this.selectedCategories.includes(category);
  },

  toggleCategoryFilter(category) {
    this.selectedCategories = this.isCategorySelected(category)
      ? this.selectedCategories.filter((c) => c !== category)
      : [...this.selectedCategories, category];
  },

  resetFilters() {
    this.selectedCategories = [];
  },

  entryFor(itemId) {
    const items = this.itemDoc?.items || [];
    return findEntry(items, itemId);
  },

  quantityFor(catalogItem) {
    return this.entryFor(catalogItem.id)?.quantity ?? catalogItem.defaultQuantity ?? 1;
  },

  isAssigned(catalogItem, bucketId) {
    return !!this.entryFor(catalogItem.id)?.bucketIds?.includes(bucketId);
  },

  assignedBuckets(catalogItem) {
    const ids = this.entryFor(catalogItem.id)?.bucketIds || [];
    return this.buckets.filter((bucket) => ids.includes(bucket.id));
  },

  isExcluded(catalogItem) {
    return this.entryFor(catalogItem.id)?.excluded === true;
  },

  async toggleExcluded(catalogItem) {
    const items = this.itemDoc?.items || [];
    const next = upsertEntry(
      items,
      catalogItem.id,
      { excluded: !this.isExcluded(catalogItem) },
      catalogItem
    );
    await this.persist(next).catch((err) => console.error('Failed to save excluded state', err));
  },

  async persist(items) {
    if (this.currentItem.type === 'template') {
      await updateTemplateItems(this.currentItem.id, items);
    } else {
      await updateTripItems(this.currentItem.id, items);
    }
  },

  async toggleBucket(catalogItem, bucketId) {
    const items = this.itemDoc?.items || [];
    const existing = findEntry(items, catalogItem.id);
    const currentBucketIds = existing?.bucketIds || [];
    const nextBucketIds = currentBucketIds.includes(bucketId)
      ? currentBucketIds.filter((id) => id !== bucketId)
      : [...currentBucketIds, bucketId];
    const next = upsertEntry(items, catalogItem.id, { bucketIds: nextBucketIds }, catalogItem);
    await this.persist(next).catch((err) => console.error('Failed to save bucket assignment', err));
  },

  async changeQuantity(catalogItem, delta) {
    const current = this.quantityFor(catalogItem);
    const nextQty = Math.max(1, current + delta);
    const items = this.itemDoc?.items || [];
    const next = upsertEntry(items, catalogItem.id, { quantity: nextQty }, catalogItem);
    await this.persist(next).catch((err) => console.error('Failed to save quantity', err));
  },

  openQuantityModal(catalogItem) {
    this.quantityModal = catalogItem;
  },

  closeQuantityModal() {
    this.quantityModal = null;
  },

  openBucketModal(catalogItem) {
    this.bucketModal = catalogItem;
  },

  closeBucketModal() {
    this.bucketModal = null;
  },

  get isTripWithTemplate() {
    return this.currentItem?.type === 'trip' && !!this.itemDoc?.sourceTemplateId;
  },

  async updateTemplateFromTrip() {
    if (!confirm("Overwrite the template's items with this trip's current assignments? Checked state is not affected.")) {
      return;
    }
    const items = (this.itemDoc.items || []).map(({ itemId, bucketIds, quantity }) => ({
      itemId,
      bucketIds: [...bucketIds],
      quantity,
    }));
    try {
      await updateTemplateItems(this.itemDoc.sourceTemplateId, items);
      alert('Template updated.');
    } catch (err) {
      alert(`Couldn't update template: ${err.message}`);
    }
  },

  openAddItem() {
    this.addingItem = true;
  },

  closeAddItem() {
    this.addingItem = false;
  },

  async submitNewItem() {
    const name = prompt('Item name');
    if (!name) return;
    const existingCategories = [...new Set(this.catalog.map((i) => i.category))];
    const category = prompt(
      `Category (existing: ${existingCategories.join(', ')})`,
      existingCategories[0] || ''
    );
    if (!category) return;
    const icon = prompt('Icon (a single emoji)', '📦') || '📦';
    try {
      await createCatalogItem({ category, name, icon, defaultQuantity: 1 });
    } catch (err) {
      alert(`Couldn't add item: ${err.message}`);
    } finally {
      this.closeAddItem();
    }
  },
}));

export function renderPrep(container) {
  const currentItem = getCurrentItem();

  if (!currentItem) {
    container.innerHTML = `
      <div class="screen" data-screen="prep">
        <h2>Prep</h2>
        <p class="screen-placeholder">No template or trip is open. Go to Home and open one first.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="screen" data-screen="prep" x-data="prep">
      <div class="prep-header">
        <h2 x-text="itemDoc?.name || '…'"></h2>
        <div class="prep-header-actions">
          <button class="btn-secondary" @click="openAddItem()">+ Add item to catalog</button>
          <button class="btn-secondary" x-show="isTripWithTemplate" @click="updateTemplateFromTrip()">Update template from this trip</button>
        </div>
      </div>

      <div class="category-filter-row">
        <template x-for="category in categoryNames" :key="category">
          <button
            class="filter-chip"
            :class="isCategorySelected(category) ? 'filter-chip-active' : ''"
            @click="toggleCategoryFilter(category)"
            x-text="category"
          ></button>
        </template>
        <button class="filter-chip filter-chip-reset" x-show="selectedCategories.length > 0" @click="resetFilters()">Show all</button>
      </div>

      <div class="item-list">
        <template x-for="item in filteredItems" :key="item.id">
          <div class="item-row" :class="isExcluded(item) ? 'item-row-excluded' : ''">
            <span class="item-icon-toggle" @click="toggleExcluded(item)" x-text="isExcluded(item) ? '❌' : item.icon"></span>
            <span class="item-title" @click="openQuantityModal(item)">
              <span x-text="item.name"></span>
              <span class="qty-badge" x-show="quantityFor(item) !== 1" x-text="'×' + quantityFor(item)"></span>
            </span>
            <span class="assigned-chips" @click="openBucketModal(item)">
              <template x-for="bucket in assignedBuckets(item)" :key="bucket.id">
                <span class="chip-mini" :title="bucket.name" x-text="bucket.icon"></span>
              </template>
              <span class="chip-mini chip-mini-empty" x-show="assignedBuckets(item).length === 0">+</span>
            </span>
          </div>
        </template>
      </div>

      <div class="modal-overlay" x-show="addingItem" x-cloak @click.self="closeAddItem()">
        <div class="modal-sheet">
          <h3>Add catalog item</h3>
          <p class="screen-placeholder">You'll be asked for a name, category, and icon.</p>
          <button @click="submitNewItem()">Continue</button>
          <button class="btn-secondary" @click="closeAddItem()">Cancel</button>
        </div>
      </div>

      <div class="modal-overlay" x-show="quantityModal" x-cloak @click.self="closeQuantityModal()">
        <div class="modal-sheet">
          <h3 x-text="quantityModal ? quantityModal.icon + ' ' + quantityModal.name : ''"></h3>
          <span class="qty-stepper qty-stepper-modal">
            <button class="qty-btn" @click="changeQuantity(quantityModal, -1)">−</button>
            <span class="qty-value" x-text="quantityModal ? quantityFor(quantityModal) : ''"></span>
            <button class="qty-btn" @click="changeQuantity(quantityModal, 1)">+</button>
          </span>
          <button class="btn-secondary" @click="closeQuantityModal()">Done</button>
        </div>
      </div>

      <div class="modal-overlay" x-show="bucketModal" x-cloak @click.self="closeBucketModal()">
        <div class="modal-sheet">
          <h3 x-text="bucketModal ? bucketModal.icon + ' ' + bucketModal.name : ''"></h3>
          <template x-for="bucket in buckets" :key="bucket.id">
            <button
              class="bucket-toggle-btn"
              :class="bucketModal && isAssigned(bucketModal, bucket.id) ? 'bucket-toggle-active' : ''"
              @click="toggleBucket(bucketModal, bucket.id)">
              <span x-text="bucket.icon"></span>
              <span x-text="bucket.name"></span>
              <span class="bucket-toggle-check" x-show="bucketModal && isAssigned(bucketModal, bucket.id)">✓</span>
            </button>
          </template>
          <button class="btn-secondary" @click="closeBucketModal()">Done</button>
        </div>
      </div>
    </div>
  `;
}

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

const LONG_PRESS_MS = 500;

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
  expanded: {},
  addingItem: false,
  quantityModal: null, // catalog item currently being edited, or null
  pressTimer: null,

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

  get categories() {
    const byCategory = new Map();
    for (const item of this.catalog) {
      if (!byCategory.has(item.category)) byCategory.set(item.category, []);
      byCategory.get(item.category).push(item);
    }
    return [...byCategory.keys()]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .map((category) => ({
        category,
        items: byCategory.get(category).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }));
  },

  isExpanded(category) {
    return this.expanded[category] !== false; // default open
  },

  toggleCategory(category) {
    this.expanded[category] = !this.isExpanded(category);
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

  startItemPress(catalogItem) {
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.quantityModal = catalogItem;
    }, LONG_PRESS_MS);
  },

  cancelItemPress() {
    clearTimeout(this.pressTimer);
  },

  closeQuantityModal() {
    this.quantityModal = null;
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

      <template x-for="group in categories" :key="group.category">
        <section class="category-section">
          <button class="category-header" @click="toggleCategory(group.category)">
            <span x-text="group.category"></span>
            <span x-text="isExpanded(group.category) ? '▾' : '▸'"></span>
          </button>
          <div class="category-items" x-show="isExpanded(group.category)">
            <template x-for="item in group.items" :key="item.id">
              <div class="item-row">
                <span class="item-name"
                      @touchstart="startItemPress(item)" @touchend="cancelItemPress()" @touchmove="cancelItemPress()"
                      @mousedown="startItemPress(item)" @mouseup="cancelItemPress()" @mouseleave="cancelItemPress()"
                      @contextmenu.prevent>
                  <span x-text="item.icon"></span>
                  <span x-text="item.name"></span>
                  <span class="qty-badge" x-show="quantityFor(item) !== 1" x-text="'×' + quantityFor(item)"></span>
                </span>
                <span class="chip-strip">
                  <template x-for="bucket in buckets" :key="bucket.id">
                    <button
                      class="chip"
                      :class="isAssigned(item, bucket.id) ? 'chip-active' : ''"
                      :title="bucket.name"
                      @click="toggleBucket(item, bucket.id)"
                      x-text="bucket.icon"
                    ></button>
                  </template>
                </span>
              </div>
            </template>
          </div>
        </section>
      </template>

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
    </div>
  `;
}

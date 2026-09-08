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
  comboFilterActive: false,
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
    let items =
      this.selectedCategories.length === 0
        ? this.catalog
        : this.catalog.filter((item) => this.selectedCategories.includes(item.category));
    if (this.comboFilterActive) {
      items = items.filter((item) => this.comboStateFor(item));
    }
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

  toggleComboFilter() {
    this.comboFilterActive = !this.comboFilterActive;
  },

  get hasActiveFilters() {
    return this.selectedCategories.length > 0 || this.comboFilterActive;
  },

  resetFilters() {
    this.selectedCategories = [];
    this.comboFilterActive = false;
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

  get kofferBucket() {
    return this.buckets.find((bucket) => bucket.name === 'Koffer');
  },

  get hinreiseBucket() {
    return this.buckets.find((bucket) => bucket.name === 'Hinreise');
  },

  // 'koffer' | 'hinreise' | null. Independent of bucketIds — selecting the
  // combo in the modal clears any direct Koffer/Hinreise assignment, and
  // selecting Koffer/Hinreise directly clears the combo, so the two never
  // overlap.
  comboStateFor(catalogItem) {
    const side = this.entryFor(catalogItem.id)?.comboSide;
    return side === 'koffer' || side === 'hinreise' ? side : null;
  },

  // Row-level chip: flips directly between the two sides, no modal.
  async toggleComboBucket(catalogItem) {
    const combo = this.comboStateFor(catalogItem);
    if (!combo) return;
    const items = this.itemDoc?.items || [];
    const next = upsertEntry(
      items,
      catalogItem.id,
      { comboSide: combo === 'koffer' ? 'hinreise' : 'koffer' },
      catalogItem
    );
    await this.persist(next).catch((err) => console.error('Failed to toggle Koffer/Hinreise', err));
  },

  // Modal row: selecting the combo (default Koffer) clears any direct
  // Koffer/Hinreise bucket assignment; tapping again clears the combo.
  async toggleComboSelection(catalogItem) {
    if (!this.kofferBucket || !this.hinreiseBucket) return;
    const items = this.itemDoc?.items || [];
    const existing = findEntry(items, catalogItem.id);
    const alreadyCombo = !!this.comboStateFor(catalogItem);
    const excludeIds = new Set([this.kofferBucket.id, this.hinreiseBucket.id]);
    const nextBucketIds = (existing?.bucketIds || []).filter((id) => !excludeIds.has(id));
    const patch = alreadyCombo
      ? { comboSide: null, bucketIds: nextBucketIds }
      : { comboSide: 'koffer', bucketIds: nextBucketIds };
    const next = upsertEntry(items, catalogItem.id, patch, catalogItem);
    await this.persist(next).catch((err) => console.error('Failed to toggle Koffer/Hinreise', err));
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
    const turningOn = !currentBucketIds.includes(bucketId);
    const nextBucketIds = turningOn
      ? [...currentBucketIds, bucketId]
      : currentBucketIds.filter((id) => id !== bucketId);
    const patch = { bucketIds: nextBucketIds };
    const isComboMember = bucketId === this.kofferBucket?.id || bucketId === this.hinreiseBucket?.id;
    if (isComboMember && turningOn && existing?.comboSide) {
      patch.comboSide = null;
    }
    const next = upsertEntry(items, catalogItem.id, patch, catalogItem);
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
    const items = (this.itemDoc.items || []).map(({ itemId, bucketIds, quantity, comboSide }) => ({
      itemId,
      bucketIds: [...bucketIds],
      quantity,
      ...(comboSide ? { comboSide } : {}),
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
        <button
          class="filter-chip filter-chip-combo"
          :class="comboFilterActive ? 'filter-chip-active' : ''"
          @click="toggleComboFilter()"
          x-show="kofferBucket && hinreiseBucket"
        >🧳✈️ Koffer/Hinreise</button>
        <template x-for="category in categoryNames" :key="category">
          <button
            class="filter-chip"
            :class="isCategorySelected(category) ? 'filter-chip-active' : ''"
            @click="toggleCategoryFilter(category)"
            x-text="category"
          ></button>
        </template>
        <button class="filter-chip filter-chip-reset" x-show="hasActiveFilters" @click="resetFilters()">Show all</button>
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
              <span
                class="chip-mini chip-mini-empty"
                x-show="comboStateFor(item) && assignedBuckets(item).length === 0"
              >+</span>
              <span
                class="chip-mini chip-mini-combo"
                x-show="comboStateFor(item)"
                :title="comboStateFor(item) === 'koffer' ? 'Koffer' : 'Hinreise'"
                @click.stop="toggleComboBucket(item)"
                x-text="comboStateFor(item) === 'koffer' ? kofferBucket?.icon : hinreiseBucket?.icon"
              ></span>
              <span
                class="chip-mini chip-mini-empty"
                x-show="!comboStateFor(item) && assignedBuckets(item).length === 0"
              >+</span>
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
          <template x-if="kofferBucket && hinreiseBucket">
            <button
              class="bucket-toggle-btn bucket-toggle-combo"
              :class="bucketModal && comboStateFor(bucketModal) ? 'bucket-toggle-active' : ''"
              @click="toggleComboSelection(bucketModal)">
              <span x-text="bucketModal && comboStateFor(bucketModal) === 'hinreise' ? hinreiseBucket.icon : kofferBucket.icon"></span>
              <span>Koffer/Hinreise</span>
              <span class="bucket-toggle-check" x-show="bucketModal && comboStateFor(bucketModal)">✓</span>
            </button>
          </template>
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

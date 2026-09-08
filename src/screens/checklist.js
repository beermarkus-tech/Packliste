import Alpine from 'alpinejs';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { getCurrentItem } from '../lib/store.js';
import { watchCatalog } from '../data/catalog.js';
import { watchBuckets } from '../data/buckets.js';
import { updateTripItems } from '../data/trips.js';

Alpine.data('checklist', () => ({
  currentItem: getCurrentItem(),
  itemDoc: null,
  catalog: [],
  buckets: [],
  activeBucketId: null,

  init() {
    if (!this.currentItem || this.currentItem.type !== 'trip') return;

    this._unsubDoc = onSnapshot(doc(db, 'trips', this.currentItem.id), (snap) => {
      this.itemDoc = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    });
    this._unsubCatalog = watchCatalog((list) => {
      this.catalog = list;
    });
    this._unsubBuckets = watchBuckets((list) => {
      this.buckets = list;
      if (!this.activeBucketId && list.length > 0) {
        this.activeBucketId = list[0].id;
      }
    });
  },

  destroy() {
    this._unsubDoc?.();
    this._unsubCatalog?.();
    this._unsubBuckets?.();
  },

  selectBucket(bucketId) {
    this.activeBucketId = bucketId;
  },

  catalogFor(itemId) {
    return this.catalog.find((c) => c.id === itemId);
  },

  get kofferBucket() {
    return this.buckets.find((bucket) => bucket.name === 'Koffer');
  },

  get hinreiseBucket() {
    return this.buckets.find((bucket) => bucket.name === 'Hinreise');
  },

  isChecked(entry, bucketId) {
    return !!entry.checked?.[bucketId];
  },

  // An item counts as "in" a bucket either via bucketIds, or via the
  // Koffer/Hinreise combo toggle on Prep (which is tracked separately).
  isInBucket(entry, bucketId) {
    if (entry.bucketIds?.includes(bucketId)) return true;
    if (entry.comboSide === 'koffer' && bucketId === this.kofferBucket?.id) return true;
    if (entry.comboSide === 'hinreise' && bucketId === this.hinreiseBucket?.id) return true;
    return false;
  },

  itemsForBucket(bucketId) {
    const rows = (this.itemDoc?.items || [])
      .filter((entry) => !entry.excluded && this.isInBucket(entry, bucketId))
      .map((entry) => ({ entry, catalogItem: this.catalogFor(entry.itemId) }))
      .filter((row) => !!row.catalogItem);

    return rows.sort((a, b) => {
      if (a.catalogItem.category !== b.catalogItem.category) {
        return a.catalogItem.category.localeCompare(b.catalogItem.category, 'de');
      }
      const checkedA = this.isChecked(a.entry, bucketId);
      const checkedB = this.isChecked(b.entry, bucketId);
      if (checkedA !== checkedB) return checkedA ? 1 : -1;
      return a.catalogItem.name.localeCompare(b.catalogItem.name, 'de');
    });
  },

  progressFor(bucketId) {
    const rows = this.itemsForBucket(bucketId);
    const done = rows.filter((row) => this.isChecked(row.entry, bucketId)).length;
    return `${done}/${rows.length}`;
  },

  isBucketComplete(bucketId) {
    const rows = this.itemsForBucket(bucketId);
    return rows.length > 0 && rows.every((row) => this.isChecked(row.entry, bucketId));
  },

  async toggleChecked(entry, bucketId) {
    const items = this.itemDoc?.items || [];
    const next = items.map((e) => {
      if (e.itemId !== entry.itemId) return e;
      const checked = { ...(e.checked || {}) };
      checked[bucketId] = !checked[bucketId];
      return { ...e, bucketIds: [...e.bucketIds], checked };
    });
    try {
      await updateTripItems(this.currentItem.id, next);
    } catch (err) {
      console.error('Failed to save checked state', err);
    }
  },
}));

export function renderChecklist(container) {
  const currentItem = getCurrentItem();

  if (!currentItem || currentItem.type !== 'trip') {
    container.innerHTML = `
      <div class="screen" data-screen="checklist">
        <h2>Checklist</h2>
        <p class="screen-placeholder">Checklists are only available on trips. Open a trip from Home.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="screen" data-screen="checklist" x-data="checklist">
      <h2 x-text="itemDoc?.name || '…'"></h2>

      <div class="bucket-tabs">
        <template x-for="bucket in buckets" :key="bucket.id">
          <button
            class="filter-chip"
            :class="(activeBucketId === bucket.id ? 'filter-chip-active ' : '') + (isBucketComplete(bucket.id) ? 'filter-chip-complete' : '')"
            @click="selectBucket(bucket.id)">
            <span x-text="bucket.icon"></span>
            <span x-text="bucket.name"></span>
          </button>
        </template>
      </div>

      <div class="bucket-panels">
        <template x-for="bucket in buckets" :key="bucket.id">
          <div class="bucket-panel" :class="activeBucketId === bucket.id ? 'bucket-panel-active' : ''">
            <div class="bucket-panel-header">
              <span x-text="bucket.icon + ' ' + bucket.name"></span>
              <span class="bucket-progress" x-text="progressFor(bucket.id) + ' ' + (bucket.type === 'tasklist' ? 'done' : 'packed')"></span>
            </div>
            <p class="screen-placeholder" x-show="itemsForBucket(bucket.id).length === 0">Nothing here yet.</p>
            <ul class="checklist-list">
              <template x-for="row in itemsForBucket(bucket.id)" :key="row.entry.itemId">
                <li class="checklist-row"
                    :class="isChecked(row.entry, bucket.id) ? 'checklist-row-checked' : ''"
                    @click="toggleChecked(row.entry, bucket.id)">
                  <span class="checklist-checkbox" :class="isChecked(row.entry, bucket.id) ? 'checklist-checkbox-checked' : ''">
                    <span x-show="isChecked(row.entry, bucket.id)">✓</span>
                  </span>
                  <span class="checklist-icon" x-text="row.catalogItem.icon"></span>
                  <span class="checklist-name" x-text="row.catalogItem.name"></span>
                  <span class="qty-badge" x-text="'×' + row.entry.quantity"></span>
                </li>
              </template>
            </ul>
          </div>
        </template>
      </div>
    </div>
  `;
}

import Alpine from 'alpinejs';
import { watchBuckets, createBucket, renameBucket, deleteBucket } from '../data/buckets.js';
import { signOutUser } from '../lib/auth.js';
import { migrateTripsToLocalCatalog } from '../data/migrateTripsToLocalCatalog.js';

const LONG_PRESS_MS = 500;

Alpine.data('settings', () => ({
  buckets: [],
  actionSheet: null, // { bucket }
  creating: false,
  newBucketIcon: '🧳',
  newBucketName: '',
  newBucketType: 'luggage',
  pressTimer: null,
  migrateStatus: '',
  migrating: false,

  init() {
    this._unsubBuckets = watchBuckets((list) => {
      this.buckets = list;
    });
  },

  destroy() {
    this._unsubBuckets?.();
  },

  startPress(bucket) {
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.actionSheet = { bucket };
    }, LONG_PRESS_MS);
  },

  cancelPress() {
    clearTimeout(this.pressTimer);
  },

  closeActionSheet() {
    this.actionSheet = null;
  },

  async doRename() {
    const { bucket } = this.actionSheet;
    this.closeActionSheet();
    const name = prompt('New name', bucket.name);
    if (!name) return;
    try {
      await renameBucket(bucket.id, name);
    } catch (err) {
      alert(`Couldn't rename: ${err.message}`);
    }
  },

  async doDelete() {
    const { bucket } = this.actionSheet;
    this.closeActionSheet();
    if (!confirm(`Delete "${bucket.name}"? This can't be undone.`)) return;
    try {
      await deleteBucket(bucket.id);
    } catch (err) {
      alert(`Couldn't delete: ${err.message}`);
    }
  },

  openNewBucket() {
    this.creating = true;
    this.newBucketIcon = '🧳';
    this.newBucketName = '';
    this.newBucketType = 'luggage';
  },

  closeNewBucket() {
    this.creating = false;
  },

  async submitNewBucket() {
    const name = this.newBucketName.trim();
    if (!name) return;
    const icon = this.newBucketIcon.trim() || '🧳';
    try {
      await createBucket({ name, icon, type: this.newBucketType });
      this.closeNewBucket();
    } catch (err) {
      alert(`Couldn't add bucket: ${err.message}`);
    }
  },

  signOut() {
    if (!confirm('Sign out?')) return;
    signOutUser();
  },

  async runTripMigration() {
    if (
      !confirm(
        "This backfills every existing trip with a snapshot of the current catalog, so its items stop depending on the shared catalog (matching newly-created trips). It only adds items a trip doesn't already have — safe to run more than once. Continue?"
      )
    ) {
      return;
    }
    this.migrating = true;
    this.migrateStatus = 'Migrating…';
    try {
      const result = await migrateTripsToLocalCatalog();
      this.migrateStatus = `Done. Updated ${result.tripsUpdated} of ${result.tripCount} trip(s), added ${result.itemsAdded} item(s) total.`;
    } catch (err) {
      this.migrateStatus = `Failed: ${err.message}`;
    } finally {
      this.migrating = false;
    }
  },
}));

export function renderSettings(container) {
  container.innerHTML = `
    <div class="screen" data-screen="settings" x-data="settings">
      <h2>Settings</h2>

      <section class="settings-section">
        <div class="home-list-header">
          <h3>Buckets</h3>
          <button class="btn-secondary" @click="openNewBucket()">+ New Bucket</button>
        </div>
        <p class="screen-placeholder" x-show="buckets.length === 0">No buckets yet.</p>
        <ul class="card-list">
          <template x-for="bucket in buckets" :key="bucket.id">
            <li class="card-item"
                @touchstart="startPress(bucket)" @touchend="cancelPress()" @touchmove="cancelPress()"
                @mousedown="startPress(bucket)" @mouseup="cancelPress()" @mouseleave="cancelPress()"
                @contextmenu.prevent>
              <span x-text="bucket.icon + ' ' + bucket.name"></span>
              <span class="card-sub" x-show="bucket.type === 'tasklist'">Task list</span>
            </li>
          </template>
        </ul>
      </section>

      <section class="settings-section">
        <h3>One-time: snapshot catalog into existing trips</h3>
        <p class="screen-placeholder">Trips created before this feature still depend on the shared catalog for item names/icons. Run this once to give them their own independent copy too — ask Claude to remove this section afterward.</p>
        <button class="btn-primary" :disabled="migrating" @click="runTripMigration()">Run migration</button>
        <p x-text="migrateStatus"></p>
      </section>

      <section class="settings-section">
        <h3>Account</h3>
        <button class="btn-secondary" @click="signOut()">Sign out</button>
      </section>

      <div class="modal-overlay" x-show="actionSheet" x-cloak @click.self="closeActionSheet()">
        <div class="modal-sheet" x-show="actionSheet">
          <h3 x-text="actionSheet?.bucket?.name"></h3>
          <button @click="doRename()">Rename</button>
          <button class="danger" @click="doDelete()">Delete</button>
          <button class="btn-secondary" @click="closeActionSheet()">Cancel</button>
        </div>
      </div>

      <div class="modal-overlay" x-show="creating" x-cloak @click.self="closeNewBucket()">
        <div class="modal-sheet" x-show="creating">
          <h3>New Bucket</h3>
          <input type="text" class="text-input" x-model="newBucketIcon" placeholder="Icon" maxlength="4" />
          <input type="text" class="text-input" x-model="newBucketName" placeholder="Bucket name" autofocus />
          <select class="text-input" x-model="newBucketType">
            <option value="luggage">Luggage</option>
            <option value="tasklist">Task list</option>
          </select>
          <button @click="submitNewBucket()">Add</button>
          <button class="btn-secondary" @click="closeNewBucket()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

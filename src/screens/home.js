import Alpine from 'alpinejs';
import { navigateTo } from '../lib/router.js';
import { setCurrentItem } from '../lib/store.js';
import {
  watchTemplates,
  createTemplate,
  duplicateTemplate,
  renameTemplate,
  deleteTemplate,
} from '../data/templates.js';
import {
  watchTrips,
  createTrip,
  createTripFromTemplate,
  duplicateTrip,
  renameTrip,
  deleteTrip,
} from '../data/trips.js';

const LONG_PRESS_MS = 500;

Alpine.data('home', () => ({
  templates: [],
  trips: [],
  actionSheet: null, // { type, item }
  creating: null, // 'template' | 'trip'
  pressTimer: null,

  init() {
    this._unsubTemplates = watchTemplates((list) => {
      this.templates = list;
    });
    this._unsubTrips = watchTrips((list) => {
      this.trips = list;
    });
  },

  destroy() {
    this._unsubTemplates?.();
    this._unsubTrips?.();
  },

  startPress(type, item) {
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.actionSheet = { type, item };
    }, LONG_PRESS_MS);
  },

  cancelPress() {
    clearTimeout(this.pressTimer);
  },

  openItem(type, id) {
    setCurrentItem({ type, id });
    navigateTo('prep');
  },

  closeActionSheet() {
    this.actionSheet = null;
  },

  async doOpen() {
    const { type, item } = this.actionSheet;
    this.closeActionSheet();
    this.openItem(type, item.id);
  },

  async doDuplicate() {
    const { type, item } = this.actionSheet;
    this.closeActionSheet();
    try {
      if (type === 'template') {
        await duplicateTemplate(item.id);
      } else {
        await duplicateTrip(item.id);
      }
    } catch (err) {
      alert(`Couldn't duplicate: ${err.message}`);
    }
  },

  async doRename() {
    const { type, item } = this.actionSheet;
    this.closeActionSheet();
    const name = prompt('New name', item.name);
    if (!name) return;
    try {
      if (type === 'template') {
        await renameTemplate(item.id, name);
      } else {
        await renameTrip(item.id, name);
      }
    } catch (err) {
      alert(`Couldn't rename: ${err.message}`);
    }
  },

  async doDelete() {
    const { type, item } = this.actionSheet;
    this.closeActionSheet();
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    try {
      if (type === 'template') {
        await deleteTemplate(item.id);
      } else {
        await deleteTrip(item.id);
      }
    } catch (err) {
      alert(`Couldn't delete: ${err.message}`);
    }
  },

  openNewTemplate() {
    this.creating = 'template';
  },

  openNewTrip() {
    this.creating = 'trip';
  },

  closeCreating() {
    this.creating = null;
  },

  async createBlank() {
    const name = prompt(`Name your new ${this.creating}`);
    if (!name) return;
    try {
      let id;
      if (this.creating === 'template') {
        id = await createTemplate({ name, items: [] });
        this.closeCreating();
        this.openItem('template', id);
      } else {
        id = await createTrip({ name, items: [] });
        this.closeCreating();
        this.openItem('trip', id);
      }
    } catch (err) {
      alert(`Couldn't create: ${err.message}`);
    }
  },

  async createFromTemplate(templateId, templateName) {
    const name = prompt('Name this trip', templateName) || templateName;
    try {
      const id = await createTripFromTemplate(templateId, { name });
      this.closeCreating();
      this.openItem('trip', id);
    } catch (err) {
      alert(`Couldn't create trip: ${err.message}`);
    }
  },

  async duplicateIntoNewTemplate(templateId, templateName) {
    const name = prompt('Name this template', `${templateName} (Copy)`);
    if (!name) return;
    try {
      const id = await duplicateTemplate(templateId, { name });
      this.closeCreating();
      this.openItem('template', id);
    } catch (err) {
      alert(`Couldn't create template: ${err.message}`);
    }
  },
}));

export function renderHome(container) {
  container.innerHTML = `
    <div class="screen" data-screen="home" x-data="home">
      <h2>Home</h2>
      <div class="home-lists">
        <section class="home-list">
          <div class="home-list-header">
            <h3>Templates</h3>
            <button class="btn-secondary" @click="openNewTemplate()">+ New Template</button>
          </div>
          <p class="screen-placeholder" x-show="templates.length === 0">No templates yet.</p>
          <ul class="card-list">
            <template x-for="tpl in templates" :key="tpl.id">
              <li class="card-item"
                  @click="openItem('template', tpl.id)"
                  @touchstart="startPress('template', tpl)" @touchend="cancelPress()" @touchmove="cancelPress()"
                  @mousedown="startPress('template', tpl)" @mouseup="cancelPress()" @mouseleave="cancelPress()"
                  @contextmenu.prevent>
                <span x-text="tpl.name"></span>
              </li>
            </template>
          </ul>
        </section>

        <section class="home-list">
          <div class="home-list-header">
            <h3>Trips</h3>
            <button class="btn-secondary" @click="openNewTrip()">+ New Trip</button>
          </div>
          <p class="screen-placeholder" x-show="trips.length === 0">No trips yet.</p>
          <ul class="card-list">
            <template x-for="trip in trips" :key="trip.id">
              <li class="card-item"
                  @click="openItem('trip', trip.id)"
                  @touchstart="startPress('trip', trip)" @touchend="cancelPress()" @touchmove="cancelPress()"
                  @mousedown="startPress('trip', trip)" @mouseup="cancelPress()" @mouseleave="cancelPress()"
                  @contextmenu.prevent>
                <span x-text="trip.name"></span>
                <span class="card-sub" x-show="trip.date" x-text="trip.date"></span>
              </li>
            </template>
          </ul>
        </section>
      </div>

      <div class="modal-overlay" x-show="actionSheet" x-cloak @click.self="closeActionSheet()">
        <div class="modal-sheet" x-show="actionSheet">
          <h3 x-text="actionSheet?.item?.name"></h3>
          <button @click="doOpen()">Open</button>
          <button @click="doDuplicate()">Duplicate</button>
          <button @click="doRename()">Rename</button>
          <button class="danger" @click="doDelete()">Delete</button>
          <button class="btn-secondary" @click="closeActionSheet()">Cancel</button>
        </div>
      </div>

      <div class="modal-overlay" x-show="creating" x-cloak @click.self="closeCreating()">
        <div class="modal-sheet" x-show="creating">
          <h3 x-text="creating === 'template' ? 'New Template' : 'New Trip'"></h3>
          <button @click="createBlank()">Start blank</button>

          <template x-if="creating === 'trip'">
            <div class="modal-subgroup">
              <p class="screen-placeholder" x-show="templates.length === 0">No templates to copy from yet.</p>
              <template x-for="tpl in templates" :key="tpl.id">
                <button @click="createFromTemplate(tpl.id, tpl.name)" x-text="'From: ' + tpl.name"></button>
              </template>
            </div>
          </template>

          <template x-if="creating === 'template'">
            <div class="modal-subgroup">
              <p class="screen-placeholder" x-show="templates.length === 0">No templates to duplicate yet.</p>
              <template x-for="tpl in templates" :key="tpl.id">
                <button @click="duplicateIntoNewTemplate(tpl.id, tpl.name)" x-text="'Duplicate: ' + tpl.name"></button>
              </template>
            </div>
          </template>

          <button class="btn-secondary" @click="closeCreating()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

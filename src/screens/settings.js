import { seedDatabase } from '../data/seed.js';
import { migrateDienstreiseToDatabase } from '../data/migrateDienstreiseToDatabase.js';

export function renderSettings(container) {
  container.innerHTML = `
    <div class="screen" data-screen="settings">
      <h2>Settings</h2>
      <p class="screen-placeholder">Manage buckets and catalog categories here.</p>

      <section class="settings-section">
        <h3>First-time setup</h3>
        <p class="screen-placeholder">Loads the starter buckets and catalog items. Safe to click more than once — it skips anything already loaded.</p>
        <button class="btn-primary" id="seed-btn">Seed initial data</button>
        <p id="seed-status"></p>
      </section>

      <section class="settings-section">
        <h3>One-time: migrate Dienstreise → Database</h3>
        <p class="screen-placeholder">Overwrites the old "Dienstreise" template with the current contents of the "Hamburg and Rostock" trip, renames it to "Database", and removes any other leftover templates. Meant to run exactly once — ask Claude to remove this section afterward.</p>
        <button class="btn-primary" id="migrate-btn">Run migration</button>
        <p id="migrate-status"></p>
      </section>
    </div>
  `;

  const status = container.querySelector('#seed-status');
  container.querySelector('#seed-btn').addEventListener('click', async (event) => {
    event.target.disabled = true;
    status.textContent = 'Seeding…';
    try {
      const result = await seedDatabase();
      status.textContent = `Buckets: ${result.buckets}. Catalog: ${result.catalog}.`;
    } catch (err) {
      console.error('Seeding failed', err);
      status.textContent = `Failed: ${err.message}`;
    } finally {
      event.target.disabled = false;
    }
  });

  const migrateStatus = container.querySelector('#migrate-status');
  container.querySelector('#migrate-btn').addEventListener('click', async (event) => {
    if (
      !confirm(
        'This permanently overwrites the "Dienstreise" template\'s items with a copy of the "Hamburg and Rostock" trip, renames it to "Database", and deletes any other leftover templates. Continue?'
      )
    ) {
      return;
    }
    event.target.disabled = true;
    migrateStatus.textContent = 'Migrating…';
    try {
      const result = await migrateDienstreiseToDatabase();
      migrateStatus.textContent = `Done. Copied ${result.itemCount} item(s) from "${result.sourceTripName}". Deleted ${result.deletedOtherTemplates} other leftover template(s).`;
    } catch (err) {
      console.error('Migration failed', err);
      migrateStatus.textContent = `Failed: ${err.message}`;
      event.target.disabled = false;
    }
  });
}

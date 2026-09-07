import { seedDatabase } from '../data/seed.js';

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
}

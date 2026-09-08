import './styles.css';
import Alpine from 'alpinejs';
import { registerRoute, getRender, startRouter, navigateTo } from './lib/router.js';
import { watchAuthState, isAllowedUser, signOutUser } from './lib/auth.js';
import { renderSignIn } from './screens/signin.js';
import { renderHome } from './screens/home.js';
import { renderPrep } from './screens/prep.js';
import { renderChecklist } from './screens/checklist.js';
import { renderSettings } from './screens/settings.js';

const TABS = [
  { path: 'home', icon: '🏠', label: 'Home', render: renderHome },
  { path: 'prep', icon: '🎒', label: 'Prep', render: renderPrep },
  { path: 'checklist', icon: '✔️', label: 'Checklist', render: renderChecklist },
  { path: 'settings', icon: '⚙️', label: 'Settings', render: renderSettings },
];

TABS.forEach((tab) => registerRoute(tab.path, tab.render));

window.Alpine = Alpine;
Alpine.start();

document.getElementById('build-badge').textContent = `#${import.meta.env.VITE_BUILD_NUMBER || 'dev'}`;

const app = document.querySelector('#app');
let shellStarted = false;

function renderAppShell() {
  app.innerHTML = `
    <nav class="nav-tabs">
      ${TABS.map(
        (tab) => `
          <button class="nav-tab" data-path="${tab.path}">
            <span class="nav-icon">${tab.icon}</span>
            <span class="nav-label">${tab.label}</span>
          </button>
        `
      ).join('')}
      <button class="nav-tab" id="signout-btn" title="Sign out">
        <span class="nav-icon">🚪</span>
        <span class="nav-label">Sign out</span>
      </button>
    </nav>
    <main class="app-main"></main>
  `;

  const main = app.querySelector('.app-main');
  const navButtons = app.querySelectorAll('.nav-tab[data-path]');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => navigateTo(button.dataset.path));
  });

  app.querySelector('#signout-btn').addEventListener('click', () => signOutUser());

  startRouter((path) => {
    getRender(path)(main);
    navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.path === path);
    });
  });
}

watchAuthState((user) => {
  if (isAllowedUser(user)) {
    if (!shellStarted) {
      shellStarted = true;
      renderAppShell();
    }
  } else {
    shellStarted = false;
    renderSignIn(app, { deniedUser: user || undefined });
  }
});

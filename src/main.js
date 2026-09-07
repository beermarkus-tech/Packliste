import './styles.css';
import { registerRoute, getRender, startRouter, navigateTo } from './lib/router.js';
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

const app = document.querySelector('#app');
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
  </nav>
  <main class="app-main"></main>
`;

const main = app.querySelector('.app-main');
const navButtons = app.querySelectorAll('.nav-tab');

navButtons.forEach((button) => {
  button.addEventListener('click', () => navigateTo(button.dataset.path));
});

startRouter((path) => {
  getRender(path)(main);
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.path === path);
  });
});

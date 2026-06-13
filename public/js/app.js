// Entry point: checks the session and, once authenticated, initializes the
// views. Tabs and the service worker are always set up.
(function main() {
  setupTabs();
  registerServiceWorker();
  // Auth handles the login gate and calls bootApp() once authenticated.
  Auth.init(bootApp);
})();

async function bootApp() {
  try {
    // Load approved dynamic aliases and merge them into the engine before
    // initializing the views that depend on equivalences.
    try {
      const dynamicAliases = await Data.aliases();
      Blocks.mergeAliases(dynamicAliases);
    } catch (e) {
      console.warn('No se pudieron cargar aliases dinámicos:', e.message);
    }

    await RecipesView.init();
    ValidatorView.init();
    AdjustView.init();
    EquivalencesView.init();
    await PlanView.init();
    ShoppingView.init();
    LogView.init();
  } catch (err) {
    console.error(err);
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = `Error cargando datos: ${err.message}`;
    const grid = document.getElementById('recipes-grid');
    grid.innerHTML = '';
    grid.appendChild(p);
  }
}

// PWA: register the service worker for offline support and installability.
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker no registrado:', err.message);
    });
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });
}

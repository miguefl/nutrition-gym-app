// Handles login, logout and credential changes.
// Keeps the app hidden (body.authed) until there is a valid session.
const Auth = (() => {
  let onAuthenticated = null;
  let booted = false;

  async function init(bootApp) {
    onAuthenticated = bootApp;
    bindEvents();
    document.addEventListener('auth:expired', showLogin);
    try {
      const { authenticated, username } = await Data.session();
      if (authenticated) enter(username);
      else showLogin();
    } catch {
      showLogin();
    }
  }

  function bindEvents() {
    document.getElementById('login-form').addEventListener('submit', onLogin);
    document.getElementById('btn-logout').addEventListener('click', onLogout);
    document.getElementById('btn-cred').addEventListener('click', openCred);
    document.getElementById('cred-cancel').addEventListener('click', closeCred);
    document.getElementById('cred-form').addEventListener('submit', onChangeCred);
  }

  function showLogin() {
    document.body.classList.remove('authed');
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-pass').value = '';
    document.getElementById('login-user').focus();
  }

  function enter(username) {
    document.getElementById('account-user').textContent = username || '';
    document.getElementById('login-overlay').classList.add('hidden');
    document.body.classList.add('authed');
    if (!booted && typeof onAuthenticated === 'function') {
      booted = true;
      onAuthenticated();
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    const errBox = document.getElementById('login-error');
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    btn.disabled = true;
    errBox.classList.add('hidden');
    try {
      const { username: u } = await Data.login(username, password);
      enter(u);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  }

  async function onLogout() {
    try { await Data.logout(); } catch { /* ignore: force login anyway */ }
    booted = false; // allow re-boot if another user logs in
    location.reload();
  }

  function openCred() {
    document.getElementById('cred-overlay').classList.remove('hidden');
    document.getElementById('cred-error').classList.add('hidden');
    document.getElementById('cred-form').reset();
    document.getElementById('cred-current').focus();
  }

  function closeCred() {
    document.getElementById('cred-overlay').classList.add('hidden');
  }

  async function onChangeCred(e) {
    e.preventDefault();
    const errBox = document.getElementById('cred-error');
    errBox.classList.add('hidden');
    const payload = {
      currentPassword: document.getElementById('cred-current').value,
      newUsername: document.getElementById('cred-user').value.trim() || undefined,
      newPassword: document.getElementById('cred-pass').value || undefined,
    };
    if (!payload.newUsername && !payload.newPassword) {
      errBox.textContent = 'Indica un nuevo usuario o una nueva contraseña.';
      errBox.classList.remove('hidden');
      return;
    }
    try {
      const { username } = await Data.changeCredentials(payload);
      document.getElementById('account-user').textContent = username;
      closeCred();
      toast('Credenciales actualizadas', 'ok');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  }

  return { init };
})();

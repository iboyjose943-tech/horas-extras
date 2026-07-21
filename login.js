const USUARIOS = {
  "admin": "1234",
  "luis":  "extras2026"
};

const SESSION_HORAS = 8;

(function checkSession() {
  const raw = localStorage.getItem('he_session');
  if (!raw) return;
  try {
    const sess   = JSON.parse(raw);
    const expira = sess.ts + SESSION_HORAS * 60 * 60 * 1000;
    if (SESSION_HORAS === 0 || Date.now() < expira) {
      window.location.replace('index.html');
    } else {
      localStorage.removeItem('he_session');
    }
  } catch (e) {
    localStorage.removeItem('he_session');
  }
})();

function doLogin() {
  const usuario    = document.getElementById('usuario').value.trim();
  const contrasena = document.getElementById('contrasena').value;
  const errorEl    = document.getElementById('login-error');

  errorEl.style.display = 'none';

  if (!usuario || !contrasena) {
    errorEl.textContent    = '✕ Completa usuario y contraseña.';
    errorEl.style.display  = 'block';
    return;
  }

  if (USUARIOS[usuario] !== undefined && USUARIOS[usuario] === contrasena) {
    localStorage.setItem('he_session', JSON.stringify({
      user: usuario,
      ts:   Date.now()
    }));
    window.location.replace('index.html');
  } else {
    errorEl.textContent   = '✕ Usuario o contraseña incorrectos.';
    errorEl.style.display = 'block';
    document.getElementById('contrasena').value = '';
    document.getElementById('contrasena').focus();
  }
}

function togglePw() {
  const inp  = document.getElementById('contrasena');
  const icon = document.getElementById('pw-icon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.textContent = '🙈';
  } else {
    inp.type = 'password';
    icon.textContent = '👁';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('usuario').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('contrasena').focus();
  });
  document.getElementById('contrasena').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});
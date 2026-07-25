// Si ya hay sesión activa, manda directo al index
auth.onAuthStateChanged(user => {
  if (user) window.location.replace('index.html');
});

function doLogin() {
  const correo     = document.getElementById('usuario').value.trim();
  const contrasena = document.getElementById('contrasena').value;
  const errorEl    = document.getElementById('login-error');

  errorEl.style.display = 'none';

  if (!correo || !contrasena) {
    errorEl.textContent   = '✕ Completa correo y contraseña.';
    errorEl.style.display = 'block';
    return;
  }

  auth.signInWithEmailAndPassword(correo, contrasena)
    .then(() => {
      window.location.replace('index.html');
    })
    .catch(() => {
      errorEl.textContent   = '✕ Correo o contraseña incorrectos.';
      errorEl.style.display = 'block';
      document.getElementById('contrasena').value = '';
      document.getElementById('contrasena').focus();
    });
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
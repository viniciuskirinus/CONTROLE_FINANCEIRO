import { verifyPin, setSession } from '../modules/auth.js';

export function showLoginScreen(pinHash, onSuccess) {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  screen.hidden = false;
  screen.innerHTML = `
    <div class="login-box">
      <h1>FinanceiroVK</h1>
      <p>Digite seu PIN para acessar</p>
      <div class="form-group">
        <input type="password" id="login-pin" class="form-input" placeholder="PIN" maxlength="20"
          style="text-align:center;font-size:var(--text-xl);letter-spacing:0.3em;padding:var(--sp-3)">
      </div>
      <div id="login-error" style="display:none;margin-bottom:var(--sp-3)">
        <div class="alert alert-error" style="justify-content:center">PIN incorreto</div>
      </div>
      <button id="login-btn" class="btn btn-primary" style="width:100%;padding:var(--sp-3)">Entrar</button>
    </div>
  `;

  const pinInput = screen.querySelector('#login-pin');
  const btn = screen.querySelector('#login-btn');
  const errorEl = screen.querySelector('#login-error');

  async function attempt() {
    const val = pinInput.value.trim();
    if (!val) return;

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorEl.style.display = 'none';

    const ok = await verifyPin(val, pinHash);
    if (ok) {
      setSession();
      screen.hidden = true;
      screen.innerHTML = '';
      onSuccess();
    } else {
      errorEl.style.display = '';
      pinInput.value = '';
      pinInput.focus();
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  }

  btn.addEventListener('click', attempt);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
  pinInput.focus();
}

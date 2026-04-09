import { isWizardDone, markWizardDone } from '../modules/storage.js';
import { dispatch, testConnection } from '../modules/github-api.js';
import { getCategories, getConfig } from '../modules/data-service.js';
import { formatCurrency } from '../modules/format.js';

let currentStep = 0;
let connectionTested = false;

const wizardData = {
  person: { name: '', salary: 0, monthlyGoal: 0, creditCard: { closingDay: 5 } }
};

const STEPS = [
  { heading: 'Bem-vindo ao Coinly', render: renderWelcome },
  { heading: 'Quem é você?', render: renderPerson },
  { heading: 'Conexão com o banco', render: renderConnection },
  { heading: 'Categorias padrão', render: renderCategories },
  { heading: 'Tudo pronto!', render: renderFinish }
];

export async function checkFirstRun() {
  if (isWizardDone()) return false;
  try {
    const config = await getConfig();
    if (config?.people?.length > 0) {
      markWizardDone();
      return false;
    }
  } catch { /* first run */ }
  return true;
}

export function startWizard() {
  currentStep = 0;
  connectionTested = false;
  const overlay = document.getElementById('wizard-overlay');
  overlay.removeAttribute('hidden');
  renderWizard();
}

function renderWizard() {
  const overlay = document.getElementById('wizard-overlay');
  overlay.innerHTML = `
    <div class="wizard-container">
      <div class="wizard-progress">
        ${STEPS.map((_, i) => {
          let cls = 'wizard-step-indicator';
          if (i < currentStep) cls += ' done';
          else if (i === currentStep) cls += ' active';
          return `<div class="${cls}"></div>`;
        }).join('')}
      </div>
      <div class="wizard-content"></div>
      <div class="wizard-actions"></div>
    </div>
  `;
  renderStep();
}

function renderStep() {
  const content = document.querySelector('.wizard-content');
  const actions = document.querySelector('.wizard-actions');
  if (!content || !actions) return;
  updateProgress();
  STEPS[currentStep].render(content, actions);
}

function updateProgress() {
  document.querySelectorAll('.wizard-step-indicator').forEach((el, i) => {
    el.className = 'wizard-step-indicator';
    if (i < currentStep) el.classList.add('done');
    else if (i === currentStep) el.classList.add('active');
  });
}

function goNext() {
  if (currentStep < STEPS.length - 1) { currentStep++; renderStep(); }
}

function goBack() {
  if (currentStep > 0) { currentStep--; renderStep(); }
}

function renderWelcome(content, actions) {
  content.innerHTML = `
    <div style="text-align:center;padding:var(--sp-6) 0;">
      <div style="font-size:48px;margin-bottom:var(--sp-4);">💰</div>
      <h2>${STEPS[0].heading}</h2>
      <p style="color:var(--text-secondary);margin-top:var(--sp-2);">
        Controle suas finanças de forma simples e segura.<br>
        Seus dados são armazenados no Supabase.
      </p>
    </div>
  `;
  actions.innerHTML = `<button class="btn btn-primary" id="wz-next">Começar</button>`;
  document.getElementById('wz-next').addEventListener('click', goNext);
}

function renderPerson(content, actions) {
  content.innerHTML = `
    <h2>${STEPS[1].heading}</h2>
    <div class="form-group">
      <label class="form-label" for="wz-name">Nome</label>
      <input class="form-input" id="wz-name" type="text" required placeholder="Seu nome"
             value="${esc(wizardData.person.name)}">
    </div>
    <div class="form-group">
      <label class="form-label" for="wz-salary">Salário mensal (R$)</label>
      <input class="form-input" id="wz-salary" type="number" placeholder="5000.00"
             value="${wizardData.person.salary || ''}">
    </div>
    <div class="form-group">
      <label class="form-label" for="wz-goal">Meta de economia/mês (R$)</label>
      <input class="form-input" id="wz-goal" type="number" placeholder="500.00"
             value="${wizardData.person.monthlyGoal || ''}">
    </div>
    <div class="form-group">
      <label class="form-label" for="wz-closing">Dia fechamento do cartão</label>
      <input class="form-input" id="wz-closing" type="number" min="1" max="31"
             value="${wizardData.person.creditCard.closingDay}">
    </div>
  `;

  actions.innerHTML = `
    <button class="btn btn-ghost" id="wz-back">Voltar</button>
    <button class="btn btn-primary" id="wz-next">Próximo</button>
  `;

  document.getElementById('wz-back').addEventListener('click', () => { savePerson(); goBack(); });
  document.getElementById('wz-next').addEventListener('click', () => {
    const name = document.getElementById('wz-name').value.trim();
    if (!name) { document.getElementById('wz-name').focus(); return; }
    savePerson();
    goNext();
  });
}

function savePerson() {
  wizardData.person.name = (document.getElementById('wz-name')?.value.trim() || '').toLowerCase();
  wizardData.person.salary = parseFloat(document.getElementById('wz-salary')?.value) || 0;
  wizardData.person.monthlyGoal = parseFloat(document.getElementById('wz-goal')?.value) || 0;
  wizardData.person.creditCard.closingDay = parseInt(document.getElementById('wz-closing')?.value) || 5;
}

function renderConnection(content, actions) {
  content.innerHTML = `
    <h2>${STEPS[2].heading}</h2>
    <p style="color:var(--text-secondary);margin-bottom:var(--sp-4);">
      Testando a conexão com o banco de dados Supabase...
    </p>
    <div id="wz-conn-result" style="text-align:center;padding:var(--sp-6);">
      <div class="spinner spinner-lg"></div>
    </div>
  `;
  actions.innerHTML = `
    <button class="btn btn-ghost" id="wz-back">Voltar</button>
    <button class="btn btn-primary" id="wz-next" disabled>Próximo</button>
  `;

  document.getElementById('wz-back').addEventListener('click', goBack);
  document.getElementById('wz-next').addEventListener('click', () => { if (connectionTested) goNext(); });

  testConnection().then(result => {
    const el = document.getElementById('wz-conn-result');
    if (result.success) {
      connectionTested = true;
      el.innerHTML = '<div style="padding:var(--sp-3) var(--sp-4);border-radius:var(--radius);background:var(--color-income-bg);color:var(--color-income);font-weight:500;">✅ Conexão com Supabase estabelecida!</div>';
      const next = document.getElementById('wz-next');
      if (next) next.disabled = false;
    } else {
      el.innerHTML = `<div style="padding:var(--sp-3) var(--sp-4);border-radius:var(--radius);background:var(--color-expense-bg);color:var(--color-expense);font-weight:500;">❌ Falha na conexão: ${esc(result.error)}</div>`;
    }
  });
}

async function renderCategories(content, actions) {
  content.innerHTML = `
    <h2>${STEPS[3].heading}</h2>
    <p style="color:var(--text-secondary);margin-bottom:var(--sp-4);">
      Estas são as categorias padrão. Você pode personalizá-las depois nas Configurações.
    </p>
    <div id="wz-categories" style="display:flex;align-items:center;justify-content:center;padding:var(--sp-6);">
      <div class="spinner"></div>
    </div>
  `;

  actions.innerHTML = `
    <button class="btn btn-ghost" id="wz-back">Voltar</button>
    <button class="btn btn-primary" id="wz-next">Próximo</button>
  `;

  document.getElementById('wz-back').addEventListener('click', goBack);
  document.getElementById('wz-next').addEventListener('click', goNext);

  const cats = await getCategories();
  const container = document.getElementById('wz-categories');
  if (!cats) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Não foi possível carregar categorias.</p>';
    return;
  }

  let html = '';
  if (cats.expense?.length) {
    html += `<h3 style="margin-bottom:var(--sp-1);font-size:0.9rem;color:var(--color-expense);">Despesas</h3>`;
    html += '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-1);margin-bottom:var(--sp-4);">';
    cats.expense.forEach(c => {
      html += `<span class="badge" style="background:${c.color}20;color:${c.color};border:1px solid ${c.color}40;padding:4px 10px;border-radius:var(--radius);font-size:0.82rem;">${c.icon} ${esc(c.name)}</span>`;
    });
    html += '</div>';
  }
  if (cats.income?.length) {
    html += `<h3 style="margin-bottom:var(--sp-1);font-size:0.9rem;color:var(--color-income);">Receitas</h3>`;
    html += '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-1);">';
    cats.income.forEach(c => {
      html += `<span class="badge" style="background:${c.color}20;color:${c.color};border:1px solid ${c.color}40;padding:4px 10px;border-radius:var(--radius);font-size:0.82rem;">${c.icon} ${esc(c.name)}</span>`;
    });
    html += '</div>';
  }
  container.innerHTML = html;
}

function renderFinish(content, actions) {
  const closingDay = wizardData.person.creditCard.closingDay || 5;
  content.innerHTML = `
    <div style="text-align:center;padding:var(--sp-6) 0;">
      <div style="font-size:48px;margin-bottom:var(--sp-4);">✅</div>
      <h2>${STEPS[4].heading}</h2>
      <div style="text-align:left;margin-top:var(--sp-4);" class="card">
        <p><strong>👤 Pessoa:</strong> ${esc(wizardData.person.name)}</p>
        ${wizardData.person.salary ? `<p><strong>💰 Salário:</strong> ${formatCurrency(wizardData.person.salary)}</p>` : ''}
        ${wizardData.person.monthlyGoal ? `<p><strong>🎯 Meta mensal:</strong> ${formatCurrency(wizardData.person.monthlyGoal)}</p>` : ''}
        <p><strong>🔗 Banco:</strong> Supabase PostgreSQL</p>
      </div>
    </div>
  `;

  actions.innerHTML = `<button class="btn btn-primary" id="wz-finish">Ir para o Dashboard</button>`;
  document.getElementById('wz-finish').addEventListener('click', finishWizard);
}

async function finishWizard() {
  const btn = document.getElementById('wz-finish');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  const closingDay = parseInt(wizardData.person.creditCard.closingDay) || 5;
  const configPayload = {
    people: [{
      id: 1,
      name: wizardData.person.name,
      color: '#3949ab',
      salary: parseFloat(wizardData.person.salary) || 0,
      savingsGoal: 0,
      monthlyGoal: parseFloat(wizardData.person.monthlyGoal) || 0,
      creditCard: {
        closingDay,
        paymentDay: Math.min(closingDay + 5, 28)
      }
    }],
    settings: {
      currency: 'BRL',
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo'
    }
  };

  await dispatch('update-config', configPayload).catch(() => null);

  markWizardDone();
  document.getElementById('wizard-overlay')?.setAttribute('hidden', '');
  window.dispatchEvent(new CustomEvent('wizard-complete'));
}

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str ?? '';
  return el.innerHTML;
}

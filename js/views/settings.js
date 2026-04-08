import { isWizardDone, getRepoConfig } from '../modules/storage.js';
import { getConfig } from '../modules/data-service.js';
import { formatCurrency } from '../modules/format.js';

export async function initSettings() {
  const section = document.getElementById('view-settings');

  if (!isWizardDone()) {
    section.innerHTML = `
      <div class="placeholder-view">
        <div class="placeholder-icon">⚙️</div>
        <h2>Configurações</h2>
        <p>Complete o assistente de boas-vindas para configurar o app.</p>
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div class="spinner"></div>
    </div>
  `;

  const config = await getConfig();
  const repoConfig = getRepoConfig();
  const person = config?.people?.[0];

  section.innerHTML = `
    <h2>Configurações</h2>
    <div class="card" style="margin-bottom: var(--space-md);">
      <h3>👤 Pessoa</h3>
      <p><strong>Nome:</strong> ${person?.name || 'Não configurado'}</p>
      <p><strong>Salário:</strong> ${person?.salary ? formatCurrency(person.salary) : 'Não informado'}</p>
      <p><strong>Meta mensal:</strong> ${person?.monthlyGoal ? formatCurrency(person.monthlyGoal) : 'Não informada'}</p>
      <p><strong>Fechamento fatura:</strong> Dia ${person?.creditCard?.closingDay || '-'}</p>
    </div>
    <div class="card">
      <h3>🔗 Repositório</h3>
      <p><strong>Repo:</strong> ${repoConfig.owner || '-'}/${repoConfig.repo || '-'}</p>
      <p><strong>Status:</strong> <span style="color: var(--color-income);">✅ Conectado</span></p>
    </div>
  `;
}

import { getRepoConfig } from './storage.js';

const API_VERSION = '2022-11-28';

function buildHeaders(pat) {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION
  };
}

export function isRepoConfigured() {
  const { owner, repo, pat } = getRepoConfig();
  return !!(owner && repo && pat);
}

export async function dispatch(eventType, data, target) {
  const { owner, repo, pat } = getRepoConfig();
  if (!owner || !repo) return { success: false, error: 'Repositório não configurado. Vá em Config → Repositório.' };
  if (!pat) return { success: false, error: 'PAT não configurado. Vá em Config → Repositório para configurar.' };

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: 'POST',
        headers: buildHeaders(pat),
        body: JSON.stringify({
          event_type: eventType,
          client_payload: {
            action: eventType,
            target: target || null,
            data: data,
            timestamp: new Date().toISOString()
          }
        })
      }
    );

    console.log(`[dispatch] ${eventType} → HTTP ${resp.status}`);

    if (resp.status === 204) return { success: true };
    if (resp.status === 404) return { success: false, error: 'Repo não encontrado ou PAT sem permissão de escrita. Verifique se o token tem "Contents: Read and Write".' };
    if (resp.status === 422) return { success: false, error: 'Payload inválido' };
    return { success: false, error: `HTTP ${resp.status}` };
  } catch (e) {
    console.error('[dispatch] erro de rede:', e);
    return { success: false, error: 'Falha na conexão: ' + e.message };
  }
}

export async function testConnection() {
  const { owner, repo, pat } = getRepoConfig();
  if (!owner || !repo || !pat) return { success: false, error: 'Configuração incompleta' };

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: buildHeaders(pat) }
    );
    if (!resp.ok) {
      if (resp.status === 401) return { success: false, error: 'Token inválido' };
      if (resp.status === 404) return { success: false, error: 'Repo não encontrado ou sem permissão' };
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const repoData = await resp.json();
    if (!repoData.permissions?.push) {
      return {
        success: false,
        error: 'PAT não tem permissão de escrita. No GitHub: Settings → Developer settings → Fine-grained tokens → edite o token → Repository permissions → Contents → "Read and Write".'
      };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: 'Falha na conexão: ' + e.message };
  }
}

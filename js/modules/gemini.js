const GEMINI_KEY = 'coinly_gemini_key';
const GEMINI_MODEL_KEY = 'coinly_gemini_model';
const DEFAULT_MODEL = 'gemini-2.5-flash';

const AI_PROVIDER_KEY = 'coinly_ai_provider';
const OPENROUTER_KEY = 'coinly_openrouter_key';
const OPENROUTER_MODEL_KEY = 'coinly_openrouter_model';
const OPENROUTER_MODELS_CACHE = 'coinly_openrouter_models_cache';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (estável, 20 req/dia)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (estável, 20 req/dia)' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (500 req/dia!)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (20 req/dia)' },
];

export function getAiProvider() {
  return localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
}

export function saveAiProvider(provider) {
  const v = provider === 'openrouter' ? 'openrouter' : 'gemini';
  localStorage.setItem(AI_PROVIDER_KEY, v);
}

export function getOpenRouterKey() {
  return localStorage.getItem(OPENROUTER_KEY) || '';
}

export function saveOpenRouterKey(key) {
  if (key) localStorage.setItem(OPENROUTER_KEY, key.trim());
  else localStorage.removeItem(OPENROUTER_KEY);
}

export function getOpenRouterModel() {
  return localStorage.getItem(OPENROUTER_MODEL_KEY) || '';
}

export function saveOpenRouterModel(model) {
  if (model) localStorage.setItem(OPENROUTER_MODEL_KEY, model);
  else localStorage.removeItem(OPENROUTER_MODEL_KEY);
}

export function getOpenRouterModelsCache() {
  try {
    const raw = localStorage.getItem(OPENROUTER_MODELS_CACHE);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveOpenRouterModelsList(models) {
  if (models?.length) localStorage.setItem(OPENROUTER_MODELS_CACHE, JSON.stringify(models));
  else localStorage.removeItem(OPENROUTER_MODELS_CACHE);
}

/** Sincroniza preferências de IA vindas do Supabase (app_config) para o localStorage. */
export function hydrateAiFromRemoteConfig(config) {
  if (!config) return;
  if (config.geminiModel) saveGeminiModel(config.geminiModel);
  if (config.aiProvider === 'openrouter' || config.aiProvider === 'gemini') saveAiProvider(config.aiProvider);
  if (config.openRouterModel) saveOpenRouterModel(config.openRouterModel);
}

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY) || '';
}

export function saveGeminiKey(key) {
  if (key) localStorage.setItem(GEMINI_KEY, key.trim());
  else localStorage.removeItem(GEMINI_KEY);
}

export function getGeminiModel() {
  return localStorage.getItem(GEMINI_MODEL_KEY) || DEFAULT_MODEL;
}

export function saveGeminiModel(model) {
  localStorage.setItem(GEMINI_MODEL_KEY, model);
}

export function getAvailableModels() {
  return AVAILABLE_MODELS;
}

export function isAiConfigured() {
  return getAiProvider() === 'openrouter' ? !!getOpenRouterKey() : !!getGeminiKey();
}

export function isGeminiConfigured() {
  return isAiConfigured();
}

function getApiUrl() {
  const model = getGeminiModel();
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function openRouterHeaders(apiKey) {
  const referer = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://localhost';
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': referer,
    'X-Title': 'Coinly'
  };
}

function partsToOpenRouterUserContent(parts) {
  const content = [];
  for (const p of parts) {
    if (p.text != null) content.push({ type: 'text', text: p.text });
    else if (p.inlineData?.data) {
      const mt = p.inlineData.mimeType || 'image/jpeg';
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mt};base64,${p.inlineData.data}` }
      });
    }
  }
  return content;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

let _showAlertFn = null;

export function setAlertFunction(fn) {
  _showAlertFn = fn;
}

function notifyUser(msg, type = 'warning') {
  if (_showAlertFn) _showAlertFn(msg, type);
  else console.warn(`[IA] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRetryableError(status, body) {
  if (status === 429) return true;
  if (status === 503) return true;
  const msg = (body?.error?.message || body?.message || '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('resource exhausted') || msg.includes('temporarily unavailable');
}

async function callOpenRouterChat(parts) {
  const key = getOpenRouterKey();
  if (!key) throw new Error('Chave da API OpenRouter não configurada.');

  const model = getOpenRouterModel();
  if (!model) throw new Error('Selecione um modelo OpenRouter nas configurações (carregue a lista e escolha).');

  console.log(`[OpenRouter] modelo: ${model}`);

  const messages = [{ role: 'user', content: partsToOpenRouterUserContent(parts) }];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: openRouterHeaders(key),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 8192
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      let text = data?.choices?.[0]?.message?.content;
      if (Array.isArray(text)) {
        text = text.map(b => (typeof b === 'string' ? b : b?.text || '')).join('');
      }
      if (!text || !String(text).trim()) throw new Error('Resposta vazia da API OpenRouter.');
      return String(text).trim();
    }

    const body = await resp.json().catch(() => null);
    const msg = body?.error?.message || body?.message || `HTTP ${resp.status}`;

    if (isRetryableError(resp.status, body) && attempt < MAX_RETRIES) {
      const waitSec = (RETRY_DELAY_MS * attempt) / 1000;
      notifyUser(`Serviço ocupado. Tentando novamente em ${waitSec}s... (tentativa ${attempt}/${MAX_RETRIES})`, 'warning');
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (resp.status === 401) throw new Error('Chave OpenRouter inválida ou expirada.');
    if (resp.status === 400) throw new Error(`Requisição inválida: ${msg}`);
    if (resp.status === 402) throw new Error('Créditos insuficientes na OpenRouter ou modelo pago.');
    if (resp.status === 429) throw new Error('Limite de requisições atingido. Aguarde ou troque de modelo/plano.');
    if (resp.status === 503) throw new Error('Modelo temporariamente indisponível. Tente novamente em alguns minutos.');
    throw new Error(`Erro OpenRouter: ${msg}`);
  }

  throw new Error('Número máximo de tentativas atingido.');
}

async function callGeminiApi(parts) {
  const key = getGeminiKey();
  if (!key) throw new Error('Chave da API Gemini não configurada.');

  const url = getApiUrl();
  const model = getGeminiModel();
  console.log(`[Gemini] modelo: ${model}`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(`${url}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Resposta vazia da API Gemini.');
      return text;
    }

    const body = await resp.json().catch(() => null);
    const msg = body?.error?.message || `HTTP ${resp.status}`;

    if (isRetryableError(resp.status, body) && attempt < MAX_RETRIES) {
      const waitSec = (RETRY_DELAY_MS * attempt) / 1000;
      notifyUser(`Modelo ocupado. Tentando novamente em ${waitSec}s... (tentativa ${attempt}/${MAX_RETRIES})`, 'warning');
      await sleep(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (resp.status === 400) throw new Error(`Requisição inválida: ${msg}`);
    if (resp.status === 403) throw new Error('Chave da API sem permissão. Verifique nas configurações.');
    if (resp.status === 429) throw new Error('Limite de requisições atingido após várias tentativas. Troque o modelo nas configurações ou aguarde.');
    if (resp.status === 503) throw new Error('Modelo temporariamente indisponível após várias tentativas. Tente novamente em alguns minutos.');
    throw new Error(`Erro da API Gemini: ${msg}`);
  }

  throw new Error('Número máximo de tentativas atingido.');
}

async function generateFromParts(parts) {
  if (getAiProvider() === 'openrouter') return callOpenRouterChat(parts);
  return callGeminiApi(parts);
}

function extractJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

function buildCategoryList(categories) {
  const lines = [];
  if (categories?.expense?.length) {
    lines.push('CATEGORIAS DE DESPESA:');
    categories.expense.forEach(c => {
      const subs = c.subcategories?.length ? ` (subcategorias: ${c.subcategories.join(', ')})` : '';
      lines.push(`- ${c.name}${subs}`);
    });
  }
  if (categories?.income?.length) {
    lines.push('CATEGORIAS DE RECEITA:');
    categories.income.forEach(c => {
      const subs = c.subcategories?.length ? ` (subcategorias: ${c.subcategories.join(', ')})` : '';
      lines.push(`- ${c.name}${subs}`);
    });
  }
  return lines.join('\n');
}

export async function analyzeReceipt(imageBase64, mimeType, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Analise este comprovante/recibo e extraia as informações da transação financeira.

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "date": "YYYY-MM-DD",
  "description": "descrição curta do que foi comprado/pago",
  "amount": 0.00,
  "type": "expense" ou "income",
  "category": "nome exato de uma das categorias acima",
  "subcategory": "subcategoria se aplicável, ou vazio",
  "confidence": 0.0 a 1.0
}

Regras:
- O campo "category" DEVE ser exatamente um dos nomes listados acima
- O campo "type" deve ser "expense" para pagamentos/compras e "income" para recebimentos
- O valor "amount" deve ser numérico sem símbolo de moeda
- Se não conseguir extrair algo, use string vazia ou 0
- A data deve estar no formato YYYY-MM-DD`;

  const parts = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: prompt }
  ];

  const text = await generateFromParts(parts);
  return extractJSON(text);
}

export async function analyzeStatement(imageBase64, mimeType, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Analise esta imagem de extrato bancário ou fatura e extraia TODAS as transações visíveis, incluindo receitas (salário, transferências recebidas, créditos) e despesas.

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "descrição da transação",
      "amount": 0.00,
      "type": "expense ou income",
      "category": "nome exato de uma das categorias acima (despesa ou receita conforme o type)",
      "subcategory": "subcategoria se aplicável, ou vazio"
    }
  ]
}

Regras:
- Extraia TODAS as linhas de transação visíveis
- Identifique se cada transação é "expense" (débito, pagamento, compra) ou "income" (crédito, salário, transferência recebida, depósito)
- O campo "category" DEVE ser exatamente um dos nomes listados acima, da lista de despesa ou receita conforme o type
- O valor "amount" deve ser numérico positivo sem símbolo de moeda
- Se a data não tiver ano, use o ano atual (${new Date().getFullYear()})
- Use formato YYYY-MM-DD para datas
- Descrição deve ser limpa e legível`;

  const parts = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: prompt }
  ];

  const text = await generateFromParts(parts);
  const result = extractJSON(text);
  return result.items || result;
}

export async function suggestCategory(description, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Dada a descrição de uma transação financeira, sugira a melhor categoria.

Descrição: "${description}"

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "category": "nome exato de uma das categorias acima",
  "subcategory": "subcategoria se aplicável, ou vazio",
  "type": "expense" ou "income",
  "confidence": 0.0 a 1.0
}

Regras:
- O campo "category" DEVE ser exatamente um dos nomes listados acima
- Escolha a categoria mais provável para essa descrição
- confidence indica o quão confiante você está na sugestão`;

  const text = await generateFromParts([{ text: prompt }]);
  return extractJSON(text);
}

export async function testApiKey(key, model) {
  const testModel = model || getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent`;

  const resp = await fetch(`${url}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responda apenas: OK' }] }]
    })
  });

  if (resp.ok) return { success: true };
  if (resp.status === 400) return { success: false, error: 'Chave inválida ou modelo não disponível.' };
  if (resp.status === 403) return { success: false, error: 'Chave sem permissão para este modelo.' };
  if (resp.status === 429) return { success: false, error: 'Cota excedida para este modelo. Tente outro modelo.' };
  const body = await resp.json().catch(() => null);
  return { success: false, error: body?.error?.message || `Erro HTTP ${resp.status}` };
}

export async function fetchOpenRouterModels(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) return { success: false, error: 'Informe a chave da API OpenRouter.' };

  const resp = await fetch(OPENROUTER_MODELS_URL, { headers: openRouterHeaders(key) });
  const body = await resp.json().catch(() => null);

  if (!resp.ok) {
    const msg = body?.error?.message || body?.message || `HTTP ${resp.status}`;
    return { success: false, error: msg };
  }

  const rows = (body?.data || [])
    .map(m => ({
      id: m.id,
      name: (m.name && String(m.name).trim()) ? m.name : m.id
    }))
    .filter(m => m.id);

  rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'));
  saveOpenRouterModelsList(rows);
  return { success: true, models: rows };
}

export async function testOpenRouterApiKey(key, model) {
  const trimmed = (key || '').trim();
  if (!trimmed) return { success: false, error: 'Informe a chave para testar.' };

  const m = model || getOpenRouterModel();
  if (!m) return { success: false, error: 'Selecione um modelo (use «Carregar modelos» e escolha na lista).' };

  const resp = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: openRouterHeaders(trimmed),
    body: JSON.stringify({
      model: m,
      messages: [{ role: 'user', content: 'Responda apenas: OK' }],
      max_tokens: 16
    })
  });

  if (resp.ok) return { success: true };
  if (resp.status === 401) return { success: false, error: 'Chave inválida ou sem permissão.' };
  if (resp.status === 402) return { success: false, error: 'Créditos insuficientes ou modelo exige pagamento.' };
  if (resp.status === 429) return { success: false, error: 'Limite de taxa ou cota excedida.' };
  const body = await resp.json().catch(() => null);
  return { success: false, error: body?.error?.message || body?.message || `Erro HTTP ${resp.status}` };
}

export async function compressImage(file, maxSizeKB = 1024) {
  if (file.type === 'application/pdf') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        resolve({ base64, mimeType: 'application/pdf' });
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        const MAX_DIM = 2048;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

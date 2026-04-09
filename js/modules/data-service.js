import { getSupabase } from './supabase.js';

const cache = new Map();

function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date))
      ? toCamelCase(v) : v;
  }
  return out;
}

export async function getConfig() {
  if (cache.has('config')) return cache.get('config');
  const sb = getSupabase();

  const [peopleRes, budgetsRes, salaryRes, configRes] = await Promise.all([
    sb.from('people').select('*').order('id'),
    sb.from('budgets').select('*'),
    sb.from('salary_history').select('*').order('year_month'),
    sb.from('app_config').select('*')
  ]);

  const people = (peopleRes.data || []).map(p => {
    const salaryEntries = (salaryRes.data || [])
      .filter(s => s.person === p.name)
      .map(s => ({ date: s.year_month, amount: Number(s.amount) }));

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      salary: Number(p.salary),
      monthlyGoal: Number(p.monthly_goal),
      savingsGoal: Number(p.savings_goal),
      creditCard: { closingDay: p.closing_day, paymentDay: p.payment_day },
      salaryHistory: salaryEntries
    };
  });

  const budgetMap = {};
  for (const b of (budgetsRes.data || [])) {
    if (!budgetMap[b.person]) budgetMap[b.person] = {};
    budgetMap[b.person][b.category] = Number(b.amount);
  }

  const appCfg = {};
  for (const row of (configRes.data || [])) {
    appCfg[row.key] = row.value;
  }

  const config = {
    _schema_version: 1,
    people,
    settings: {
      currency: appCfg.currency || 'BRL',
      locale: appCfg.locale || 'pt-BR',
      timezone: appCfg.timezone || 'America/Sao_Paulo'
    },
    budgets: budgetMap,
    pinHash: appCfg.pin_hash || null,
    encryptedSecrets: appCfg.encrypted_secrets || null,
    geminiModel: appCfg.gemini_model || null
  };

  cache.set('config', config);
  return config;
}

export async function getCategories() {
  if (cache.has('categories')) return cache.get('categories');
  const sb = getSupabase();

  const { data } = await sb.from('categories').select('*').order('sort_order');
  const cats = { _schema_version: 1, expense: [], income: [] };

  for (const c of (data || [])) {
    const entry = {
      name: c.name,
      icon: c.icon,
      color: c.color,
      subcategories: c.subcategories || []
    };
    if (c.type === 'expense') cats.expense.push(entry);
    else cats.income.push(entry);
  }

  cache.set('categories', cats);
  return cats;
}

export async function getTransactions(yearMonth) {
  const key = `txn-${yearMonth}`;
  if (cache.has(key)) return cache.get(key);
  const sb = getSupabase();

  const { data } = await sb.from('transactions')
    .select('*')
    .eq('year_month', yearMonth)
    .order('date', { ascending: false });

  const transactions = (data || []).map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    subcategory: t.subcategory || '',
    person: t.person,
    paymentMethod: t.payment_method,
    notes: t.notes || '',
    source: t.source || '',
    receiptUrl: t.receipt_url || '',
    createdAt: t.created_at,
    updatedAt: t.updated_at
  }));

  const maxId = transactions.length ? Math.max(...transactions.map(t => t.id)) : 0;
  const result = { _schema_version: 1, month: yearMonth, lastId: maxId, transactions };

  cache.set(key, result);
  return result;
}

export async function getPaymentMethods() {
  if (cache.has('payment-methods')) return cache.get('payment-methods');
  const sb = getSupabase();

  const { data } = await sb.from('payment_methods').select('*').order('sort_order');
  const result = { _schema_version: 1, methods: (data || []).map(m => m.name) };

  cache.set('payment-methods', result);
  return result;
}

export async function getSavings() {
  if (cache.has('savings')) return cache.get('savings');
  const sb = getSupabase();

  const [goalsRes, depositsRes] = await Promise.all([
    sb.from('savings_goals').select('*').order('created_at'),
    sb.from('savings_deposits').select('*').order('created_at')
  ]);

  const goals = (goalsRes.data || []).map(g => ({
    id: g.id,
    name: g.name,
    person: g.person,
    targetAmount: Number(g.target_amount),
    deadline: g.deadline || '',
    icon: g.icon || '',
    color: g.color || '#4f46e5',
    createdAt: g.created_at
  }));

  const deposits = (depositsRes.data || []).map(d => ({
    id: d.id,
    goalId: d.goal_id,
    amount: Number(d.amount),
    date: d.date,
    note: d.note || '',
    createdAt: d.created_at
  }));

  const result = { _schema_version: 1, goals, deposits };
  cache.set('savings', result);
  return result;
}

export function invalidateCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

export function putCacheEntry(key, data) {
  cache.set(key, data);
}

export function findDuplicates(existingTransactions, newTxn) {
  if (!existingTransactions?.length) return [];
  const normalize = s => (s || '').toLowerCase().trim();
  return existingTransactions.filter(t =>
    t.date === newTxn.date &&
    Math.abs(t.amount - newTxn.amount) < 0.01 &&
    normalize(t.description) === normalize(newTxn.description)
  );
}

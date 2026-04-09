import { getSupabase, SUPABASE_URL } from './supabase.js';
import { invalidateCache } from './data-service.js';

export function isRepoConfigured() {
  return true;
}

export async function uploadReceiptImage(file) {
  const sb = getSupabase();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await sb.storage.from('receipts').upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/receipts/${path}`;
}

export async function testConnection() {
  try {
    const sb = getSupabase();
    const { error } = await sb.from('app_config').select('key').limit(1);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function dispatch(eventType, data, target) {
  try {
    switch (eventType) {
      case 'create-transaction': return await createTransaction(data, target);
      case 'edit-transaction': return await editTransaction(data, target);
      case 'delete-transaction': return await deleteTransactions(data, target);
      case 'update-config': return await updateConfig(data);
      case 'update-categories': return await updateCategories(data);
      case 'update-payment-methods': return await updatePaymentMethods(data);
      case 'update-savings': return await updateSavings(data);
      default: return { success: false, error: `Evento desconhecido: ${eventType}` };
    }
  } catch (e) {
    console.error(`[dispatch] ${eventType} error:`, e);
    return { success: false, error: e.message };
  }
}

async function createTransaction(data, yearMonth) {
  const sb = getSupabase();
  const ym = yearMonth || data.date?.slice(0, 7);

  const row = {
    date: data.date,
    description: data.description,
    amount: data.amount,
    type: data.type,
    category: data.category,
    subcategory: data.subcategory || '',
    person: data.person,
    payment_method: data.paymentMethod,
    notes: data.notes || '',
    source: data.source || '',
    year_month: ym
  };

  if (data.receiptUrl) row.receipt_url = data.receiptUrl;

  const { error } = await sb.from('transactions').insert(row);

  if (error) return { success: false, error: error.message };
  invalidateCache(`txn-${ym}`);
  return { success: true };
}

async function editTransaction(data) {
  const sb = getSupabase();

  const { error } = await sb.from('transactions').update({
    date: data.date,
    description: data.description,
    amount: data.amount,
    type: data.type,
    category: data.category,
    subcategory: data.subcategory || '',
    person: data.person,
    payment_method: data.paymentMethod,
    notes: data.notes || '',
    updated_at: new Date().toISOString()
  }).eq('id', data.id);

  if (error) return { success: false, error: error.message };
  invalidateCache(`txn-${data.date?.slice(0, 7)}`);
  return { success: true };
}

const SALARY_CATS = ['salário', 'salario', 'salary'];

async function deleteTransactions(data) {
  const sb = getSupabase();
  const ids = data.ids || [data.id];

  const { data: txns } = await sb.from('transactions').select('*').in('id', ids);

  const { error } = await sb.from('transactions').delete().in('id', ids);
  if (error) return { success: false, error: error.message };

  if (txns?.length) {
    for (const t of txns) {
      if (t.type !== 'income') continue;
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const isSalary = SALARY_CATS.some(k => cat.includes(k)) ||
        ['salário', 'salario', 'salary', 'holerite', 'proventos'].some(k => desc.includes(k));
      if (isSalary) {
        await sb.from('salary_history').delete()
          .eq('person', t.person)
          .eq('year_month', t.year_month);
      }
    }
    invalidateCache('config');
  }

  return { success: true };
}

async function updateConfig(data) {
  const sb = getSupabase();

  if (data.people) {
    const existingNames = data.people.map(p => p.name);

    await sb.from('people').delete().not('name', 'in', `(${existingNames.map(n => `"${n}"`).join(',')})`);

    for (const p of data.people) {
      const row = {
        name: p.name,
        color: p.color || '#3949ab',
        salary: p.salary || 0,
        monthly_goal: p.monthlyGoal || 0,
        savings_goal: p.savingsGoal || 0,
        closing_day: p.creditCard?.closingDay || 5,
        payment_day: p.creditCard?.paymentDay || 10,
        updated_at: new Date().toISOString()
      };

      if (p.id && typeof p.id === 'number') row.id = p.id;

      await sb.from('people').upsert(row, { onConflict: 'name' });

      if (p.salaryHistory?.length) {
        for (const h of p.salaryHistory) {
          await sb.from('salary_history').upsert({
            person: p.name,
            year_month: h.date,
            amount: h.amount
          }, { onConflict: 'person,year_month' });
        }
      }
    }
  }

  if (data.budgets) {
    await sb.from('budgets').delete().gte('id', 0);
    const rows = [];
    for (const [person, cats] of Object.entries(data.budgets)) {
      for (const [category, amount] of Object.entries(cats || {})) {
        if (amount > 0) rows.push({ person, category, amount });
      }
    }
    if (rows.length) await sb.from('budgets').insert(rows);
  }

  const configMap = {
    pinHash: 'pin_hash',
    encryptedSecrets: 'encrypted_secrets',
    geminiModel: 'gemini_model'
  };

  for (const [jsKey, dbKey] of Object.entries(configMap)) {
    if (jsKey in data) {
      await sb.from('app_config').upsert(
        { key: dbKey, value: data[jsKey] || '' },
        { onConflict: 'key' }
      );
    }
  }

  invalidateCache('config');
  return { success: true };
}

async function updateCategories(data) {
  const sb = getSupabase();

  await sb.from('categories').delete().gte('id', 0);

  const rows = [];
  let order = 0;
  for (const type of ['expense', 'income']) {
    for (const c of (data[type] || [])) {
      rows.push({
        name: c.name,
        icon: c.icon || '📁',
        color: c.color || '#78909c',
        type,
        subcategories: c.subcategories || [],
        sort_order: order++
      });
    }
  }

  if (rows.length) await sb.from('categories').insert(rows);
  invalidateCache('categories');
  return { success: true };
}

async function updatePaymentMethods(data) {
  const sb = getSupabase();
  const methods = data.methods || [];

  await sb.from('payment_methods').delete().gte('id', 0);

  if (methods.length) {
    const rows = methods.map((name, i) => ({ name, sort_order: i }));
    await sb.from('payment_methods').insert(rows);
  }

  invalidateCache('payment-methods');
  return { success: true };
}

async function updateSavings(data) {
  const sb = getSupabase();

  await sb.from('savings_deposits').delete().gte('id', 0);
  await sb.from('savings_goals').delete().gte('id', 0);

  const goalIdMap = new Map();

  for (const g of (data.goals || [])) {
    const { data: inserted, error } = await sb.from('savings_goals').insert({
      name: g.name,
      person: g.person,
      target_amount: g.targetAmount || 0,
      deadline: g.deadline || null,
      icon: g.icon || null,
      color: g.color || '#4f46e5',
      created_at: g.createdAt || new Date().toISOString()
    }).select('id').single();

    if (!error && inserted) {
      goalIdMap.set(g.id, inserted.id);
    }
  }

  for (const d of (data.deposits || [])) {
    const newGoalId = goalIdMap.get(d.goalId) || d.goalId;
    await sb.from('savings_deposits').insert({
      goal_id: newGoalId,
      amount: d.amount,
      date: d.date,
      note: d.note || '',
      created_at: d.createdAt || new Date().toISOString()
    });
  }

  invalidateCache('savings');
  return { success: true };
}

const BASE_URL = '.';
const cache = new Map();
const LOCAL_PREFIX = 'fvk_data_';

function getLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PREFIX + key));
  } catch { return null; }
}

function setLocalData(key, data) {
  try {
    localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify({ ...data, _savedAt: new Date().toISOString() }));
  } catch { /* localStorage full */ }
}

function clearLocalData(key) {
  localStorage.removeItem(LOCAL_PREFIX + key);
}

export async function getConfig() {
  return fetchJSON(`${BASE_URL}/data/config.json`, 'config');
}

export async function getCategories() {
  return fetchJSON(`${BASE_URL}/data/categories.json`, 'categories');
}

export async function getTransactions(yearMonth) {
  return fetchJSON(
    `${BASE_URL}/data/transactions/${yearMonth}.json`,
    `txn-${yearMonth}`
  );
}

export async function getPaymentMethods() {
  return fetchJSON(`${BASE_URL}/data/payment-methods.json`, 'payment-methods');
}

export async function getSavings() {
  return fetchJSON(`${BASE_URL}/data/savings.json`, 'savings');
}

async function fetchJSON(url, cacheKey) {
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const local = getLocalData(cacheKey);

  try {
    const bust = `_=${Date.now()}`;
    const sep = url.includes('?') ? '&' : '?';
    const resp = await fetch(`${url}${sep}${bust}`, { cache: 'no-store' });
    if (!resp.ok) {
      if (local) {
        cache.set(cacheKey, local);
        return local;
      }
      return null;
    }
    const remote = await resp.json();

    if (local?._savedAt) {
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      const localTime = new Date(local._savedAt).getTime();
      if (localTime > remoteTime) {
        cache.set(cacheKey, local);
        return local;
      }
      clearLocalData(cacheKey);
    }

    cache.set(cacheKey, remote);
    return remote;
  } catch {
    if (local) {
      cache.set(cacheKey, local);
      return local;
    }
    return null;
  }
}

export function invalidateCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

export function putCacheEntry(key, data) {
  cache.set(key, data);
  setLocalData(key, data);
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

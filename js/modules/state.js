let state = {
  config: null,
  categories: null,
  paymentMethods: null,
  currentView: null,
  currentMonth: null,
  currentPerson: null,
  transactions: [],
  filters: {
    month: null,
    person: null,
    type: null,
    category: null
  },
  selectedIds: new Set(),
  pendingSyncs: new Map(),
  isLoading: false
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  notify();
}

export function resetState() {
  state = {
    config: null,
    categories: null,
    paymentMethods: null,
    currentView: null,
    currentMonth: null,
    currentPerson: null,
    transactions: [],
    filters: { month: null, person: null, type: null, category: null },
    selectedIds: new Set(),
    pendingSyncs: new Map(),
    isLoading: false
  };
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => { try { fn(state); } catch(e) { console.error(e); } });
}

export function addPendingSync(id, type) {
  state.pendingSyncs.set(id, { type, status: 'syncing', ts: Date.now() });
  notify();
}

export function resolvePendingSync(id, success = true) {
  const entry = state.pendingSyncs.get(id);
  if (entry) {
    entry.status = success ? 'synced' : 'failed';
    notify();
    if (success) {
      setTimeout(() => { state.pendingSyncs.delete(id); notify(); }, 3000);
    }
  }
}

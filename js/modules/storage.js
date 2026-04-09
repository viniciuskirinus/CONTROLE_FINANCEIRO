const KEYS = {
  WIZARD_DONE: 'coinly_wizard_done',
  PENDING_WRITES: 'coinly_pending'
};

export function getRepoConfig() {
  return { configured: true };
}

export function saveRepoConfig() {}

export function isWizardDone() {
  return localStorage.getItem(KEYS.WIZARD_DONE) === 'true';
}

export function markWizardDone() {
  localStorage.setItem(KEYS.WIZARD_DONE, 'true');
}

export function getPendingWrites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.PENDING_WRITES)) || [];
  } catch {
    return [];
  }
}

export function savePendingWrites(writes) {
  localStorage.setItem(KEYS.PENDING_WRITES, JSON.stringify(writes));
}

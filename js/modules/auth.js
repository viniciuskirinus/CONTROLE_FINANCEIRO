const SESSION_KEY = 'fvk_session';

export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin, storedHash) {
  const h = await hashPin(pin);
  return h === storedHash;
}

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function setSession() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

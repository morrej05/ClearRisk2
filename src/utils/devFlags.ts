export function isDevForceProEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return localStorage.getItem('DEV_FORCE_PRO') === 'true';
}

export function setDevForcePro(enabled: boolean): void {
  if (!import.meta.env.DEV) return;
  localStorage.setItem('DEV_FORCE_PRO', enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('storage'));
}

export function toggleDevForcePro(): boolean {
  const newValue = !isDevForceProEnabled();
  setDevForcePro(newValue);
  return newValue;
}

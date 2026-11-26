export const SESSION_ENTRY_KEY = 'klinik_metadon_entered_v1';

export function shouldStartEntered(search: string, storedSessionFlag: string | null): boolean {
  try {
    const params = new URLSearchParams(search);
    if (params.get('autostart') === '1') {
      return true;
    }
  } catch {
    // Ignore malformed query strings
  }
  return storedSessionFlag === 'true';
}

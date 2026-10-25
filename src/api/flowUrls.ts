/**
 * The Power Automate HTTP-trigger flow URLs. They belong to one environment each
 * (the domain and signature are per flow), so they are not written in the code:
 * they come from the VITE_* settings in .env, which are baked in at build time —
 * keep one set per environment (e.g. .env.development / .env.production).
 */
export function flowUrl(key: string): string {
  const url = (import.meta.env as Record<string, string | undefined>)[key];
  if (!url) {
    console.error(`[config] ${key} is not set — add it to .env and rebuild.`);
    return "";
  }
  return url;
}

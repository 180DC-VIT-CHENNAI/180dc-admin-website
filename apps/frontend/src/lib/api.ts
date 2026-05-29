const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8787";

export function apiUrl(path: string) {
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : "");
  return `${base}${path}`;
}

import type { Router } from "vue-router";

let routerRef: Router | null = null;

export function setNavigationRouter(router: Router) {
  routerRef = router;
}

function currentFullPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeSpaPath(path: string): string {
  const base = String(import.meta.env.BASE_URL ?? "/");
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function shouldSkipRedirect(targetPath: string): boolean {
  const current = window.location.pathname;
  return current.includes(targetPath);
}

export function navigateToLogin(redirect?: string, reason?: string) {
  const redirectValue = redirect ?? currentFullPath();
  if (shouldSkipRedirect("/login")) return;

  if (routerRef) {
    void routerRef.push({ path: "/login", query: { redirect: redirectValue, ...(reason ? { reason } : {}) } });
    return;
  }

  const qs = new URLSearchParams({ redirect: redirectValue, ...(reason ? { reason } : {}) });
  window.location.assign(normalizeSpaPath(`/login?${qs.toString()}`));
}

export function navigateToForbidden(redirect?: string, reason?: string) {
  const redirectValue = redirect ?? currentFullPath();
  if (shouldSkipRedirect("/forbidden")) return;

  if (routerRef) {
    void routerRef.push({ path: "/forbidden", query: { redirect: redirectValue, ...(reason ? { reason } : {}) } });
    return;
  }

  const qs = new URLSearchParams({ redirect: redirectValue, ...(reason ? { reason } : {}) });
  window.location.assign(normalizeSpaPath(`/forbidden?${qs.toString()}`));
}
